import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { palette } from "@portal/shared";
import { PortalRing } from "../../components/PortalRing";
import { useI18n } from "../../lib/i18n";
import { formatEventTime } from "../../lib/format";
import { fetchTicket, type TicketWithEvent } from "../../lib/queries";
import { QR_WINDOW_SECONDS, qrActiveFrom, qrPayload } from "../../lib/qr";

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

        {/* Transfer / return land with the waitlist flow (Phase 2 step 6) */}
        <View className="mt-8 w-full flex-row gap-3">
          <View className="flex-1 items-center rounded-2xl border border-line py-3.5 opacity-40">
            <Text className="text-sm text-dim">{t.ticket.transfer}</Text>
          </View>
          <View className="flex-1 items-center rounded-2xl border border-line py-3.5 opacity-40">
            <Text className="text-sm text-dim">{t.ticket.returnTicket}</Text>
          </View>
        </View>
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
