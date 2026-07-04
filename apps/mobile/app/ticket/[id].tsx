import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { palette } from "@portal/shared";
import { PortalRing } from "../../components/PortalRing";
import { useI18n } from "../../lib/i18n";
import { formatEventTime } from "../../lib/format";
import { fetchTicket, type TicketWithEvent } from "../../lib/queries";
import { QR_WINDOW_SECONDS, qrActiveFrom, qrPayload } from "../../lib/qr";
import { supabase } from "../../lib/supabase";

// Ticket screen (spec §5.4): portal ring + rotating QR + live pulse.
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { lang, t } = useI18n();
  const [ticket, setTicket] = useState<TicketWithEvent | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchTicket(id).then(setTicket).catch(() => setTicket(null));
  }, [id]);

  // Re-render clock: refresh QR payload every rotation window (hard rule 3).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), (QR_WINDOW_SECONDS / 2) * 1000);
    return () => clearInterval(interval);
  }, []);

  const qrActive =
    ticket != null &&
    ticket.status === "active" &&
    now >= qrActiveFrom(ticket.event.doors_at).getTime();
  const glExpired =
    ticket?.product.type === "guestlist" &&
    ticket.product.gl_cutoff_time != null &&
    now > Date.parse(ticket.product.gl_cutoff_time);

  useEffect(() => {
    if (ticket && qrActive && !glExpired) {
      qrPayload(ticket.id, ticket.qr_secret).then(setPayload).catch(() => setPayload(null));
    }
  }, [ticket, qrActive, glExpired, now]);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferMsg, setTransferMsg] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);

  const isTable = ticket?.product.type === "table";
  const returnable =
    ticket?.status === "active" && Date.parse(ticket.event.starts_at) > Date.now();

  const returnTicket = useCallback(() => {
    if (!ticket) return;
    if (isTable) {
      // Hard rule 5: tables refund in full only >48h before start.
      const over48h = Date.parse(ticket.event.starts_at) - Date.now() > 48 * 3600_000;
      if (!over48h) {
        Alert.alert(t.ticket.cancelTable, t.ticket.cancelTableTooLate);
        return;
      }
      Alert.alert(t.ticket.cancelTable, t.ticket.cancelTableConfirm, [
        { text: t.venues.cancel, style: "cancel" },
        {
          text: t.ticket.cancelTable,
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.functions.invoke("cancel-table", {
              body: { ticket_id: ticket.id },
            });
            if (!error) setTicket({ ...ticket, status: "refunded" });
          },
        },
      ]);
      return;
    }
    Alert.alert(t.ticket.returnConfirmTitle, t.ticket.returnConfirmBody, [
      { text: t.venues.cancel, style: "cancel" },
      {
        text: t.ticket.returnTicket,
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.functions.invoke("return-ticket", {
            body: { ticket_id: ticket.id },
          });
          if (!error) setTicket({ ...ticket, status: "returned" });
        },
      },
    ]);
  }, [ticket, t, isTable]);

  const transfer = useCallback(async () => {
    if (!ticket) return;
    setTransferBusy(true);
    setTransferMsg(null);
    const { data, error } = await supabase.functions.invoke("transfer-ticket", {
      body: { ticket_id: ticket.id, to_email: transferEmail.trim() },
    });
    setTransferBusy(false);
    if (error || !data?.ok) {
      setTransferMsg(t.ticket.transferNotFound);
      return;
    }
    setTransferMsg(t.ticket.transferDone);
    setTicket({ ...ticket, status: "transferred" });
    setTransferOpen(false);
  }, [ticket, transferEmail, t]);

  if (!ticket) {
    return (
      <View className="flex-1 items-center justify-center bg-abyss">
        <Text className="text-dim">{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <View className="flex-1 items-center px-6 pt-2">
        <Pressable onPress={() => router.back()} className="mb-2 self-start">
          <Text className="text-dim">←</Text>
        </Pressable>

        <Text className="font-display text-2xl font-black text-bone">{ticket.event.name}</Text>
        <Text className="mt-1 text-dim">{formatEventTime(ticket.event.starts_at, lang)}</Text>

        <View className="mt-8">
          {glExpired ? (
            <StatusBlock label={t.ticket.expired} tone={palette.dim} />
          ) : ticket.status === "returned" ? (
            <StatusBlock label={t.ticket.returnedLabel} tone={palette.copper} />
          ) : ticket.status === "scanned" ? (
            <StatusBlock label={t.ticket.scanned} tone={palette.dim} />
          ) : qrActive && payload ? (
            <PortalRing size={200}>
              <QRCode value={payload} size={200} backgroundColor={palette.bone} color={palette.abyss} />
            </PortalRing>
          ) : (
            <StatusBlock label={t.ticket.qrActivates} tone={palette.copper} />
          )}
        </View>

        {qrActive && !glExpired && ticket.status === "active" && (
          <View className="mt-5 flex-row items-center">
            <View className="mr-2 h-2 w-2 rounded-full bg-seaglass" />
            <Text className="font-mono text-sm text-seaglass">{t.ticket.active}</Text>
          </View>
        )}

        <Text className="mt-6 text-xs text-dim">{t.ticket.code}</Text>
        <Text className="mt-1 font-mono text-xl tracking-[0.3em] text-bone">{ticket.code}</Text>

        <View className="mt-8 w-full flex-row gap-3">
          <Pressable
            disabled={!returnable || isTable}
            onPress={() => setTransferOpen(!transferOpen)}
            className={`flex-1 items-center rounded-2xl border py-3.5 ${
              returnable && !isTable ? "border-seaglass/60 active:opacity-80" : "border-line opacity-40"
            }`}
          >
            <Text className={`text-sm ${returnable && !isTable ? "text-seaglass" : "text-dim"}`}>
              {t.ticket.transfer}
            </Text>
          </Pressable>
          <Pressable
            disabled={!returnable}
            onPress={returnTicket}
            className={`flex-1 items-center rounded-2xl border py-3.5 ${
              returnable ? "border-copper active:opacity-80" : "border-line opacity-40"
            }`}
          >
            <Text className={`text-sm ${returnable ? "text-copper-hi" : "text-dim"}`}>
              {isTable ? t.ticket.cancelTable : t.ticket.returnTicket}
            </Text>
          </Pressable>
        </View>

        {transferOpen && returnable && !isTable && (
          <View className="mt-4 w-full">
            <TextInput
              value={transferEmail}
              onChangeText={setTransferEmail}
              placeholder={t.ticket.transferHint}
              placeholderTextColor={palette.dim}
              autoCapitalize="none"
              keyboardType="email-address"
              className="rounded-2xl border border-line bg-deep px-4 py-3 text-bone"
            />
            <Pressable
              disabled={transferBusy || !transferEmail.trim()}
              onPress={transfer}
              className="mt-3 items-center rounded-2xl bg-seaglass py-3.5 active:opacity-85 disabled:opacity-50"
            >
              <Text className="font-display font-bold text-abyss">{t.ticket.transferTitle}</Text>
            </Pressable>
          </View>
        )}
        {transferMsg && <Text className="mt-3 text-center text-sm text-seaglass">{transferMsg}</Text>}
      </View>
    </SafeAreaView>
  );
}

function StatusBlock({ label, tone }: { label: string; tone: string }) {
  return (
    <View
      className="items-center justify-center rounded-3xl border border-line bg-card px-8"
      style={{ width: 236, height: 236 }}
    >
      <Text className="text-center text-sm leading-6" style={{ color: tone }}>
        {label}
      </Text>
    </View>
  );
}
