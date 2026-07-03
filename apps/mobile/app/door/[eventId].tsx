import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { palette } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import {
  downloadManifest,
  flushQueue,
  insideCount,
  loadManifest,
  manualCheckIn,
  pendingCount,
  validateScan,
  type DoorManifest,
  type ScanOutcome,
} from "../../lib/door";

const RESULT_BG: Record<ScanOutcome["result"], string> = {
  ok: "#1E8E5A",
  already_scanned: "#8A6D1F",
  invalid: "#8E2E2E",
  expired: "#4A4A5A",
};

// The door scanner (spec §7): camera → instant verdict, works offline.
export default function DoorScanner() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [manifest, setManifest] = useState<DoorManifest | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [pending, setPending] = useState(0);
  const [query, setQuery] = useState("");
  const busyRef = useRef(false);

  const refreshPending = useCallback(() => {
    pendingCount(eventId).then(setPending).catch(() => {});
  }, [eventId]);

  const download = useCallback(async () => {
    try {
      const m = await downloadManifest(eventId);
      setManifest(m);
      const flushed = await flushQueue(eventId).catch(() => 0);
      if (flushed > 0) setManifest(await downloadManifest(eventId));
    } catch {
      const cached = await loadManifest(eventId);
      if (cached) setManifest(cached);
    }
    refreshPending();
  }, [eventId, refreshPending]);

  useEffect(() => {
    loadManifest(eventId).then((cached) => {
      if (cached) setManifest(cached);
      download();
    });
  }, [eventId, download]);

  const onScan = useCallback(
    async (payload: string) => {
      if (!manifest || busyRef.current) return;
      busyRef.current = true;
      const { outcome: result, manifest: next } = await validateScan(manifest, payload);
      setManifest({ ...next });
      setOutcome(result);
      refreshPending();
      setTimeout(() => {
        setOutcome(null);
        busyRef.current = false;
      }, 2200);
    },
    [manifest, refreshPending],
  );

  const matches = useMemo(() => {
    if (!manifest || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return Object.values(manifest.tickets)
      .filter((tk) => tk.holder_name?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [manifest, query]);

  const counts = manifest ? insideCount(manifest) : { scanned: 0, total: 0 };
  const manifestMins = manifest
    ? Math.max(0, Math.round((Date.now() - Date.parse(manifest.downloaded_at)) / 60000))
    : null;

  if (!permission?.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-abyss px-8">
        <Text className="text-center text-dim">{t.door.cameraPermission}</Text>
        <Pressable
          onPress={requestPermission}
          className="mt-4 rounded-full bg-copper px-5 py-2.5"
        >
          <Text className="font-display font-bold text-abyss">{t.door.grantCamera}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <View className="flex-1 px-4 pt-1">
        {/* Header: back · counter · manifest freshness */}
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Text className="text-dim">←</Text>
          </Pressable>
          <Text className="font-mono text-lg text-bone">
            {t.door.inside}{" "}
            <Text className="text-seaglass">{counts.scanned}</Text>
            <Text className="text-dim"> / {counts.total}</Text>
          </Text>
          <Pressable onPress={download} className="rounded-full border border-line px-3 py-1">
            <Text className="font-mono text-xs text-dim">
              {manifestMins === null ? t.door.refreshManifest : t.door.manifestAge(manifestMins)}
            </Text>
          </Pressable>
        </View>

        {/* Scanner */}
        <View className="h-72 overflow-hidden rounded-3xl border border-line">
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => onScan(data)}
          />
          {outcome && (
            <View
              className="absolute inset-0 items-center justify-center"
              style={{ backgroundColor: RESULT_BG[outcome.result] + "F0" }}
            >
              <Text className="font-display text-3xl font-black text-white">
                {outcome.result === "ok"
                  ? t.door.resultOk
                  : outcome.result === "already_scanned"
                    ? t.door.resultAlready
                    : outcome.result === "expired"
                      ? t.door.resultExpired
                      : t.door.resultInvalid}
              </Text>
              {outcome.ticket && (
                <Text className="mt-2 text-lg text-white">
                  {outcome.ticket.holder_name ?? "—"} · {outcome.ticket.product_name}
                </Text>
              )}
              {outcome.offline && (
                <Text className="mt-1 font-mono text-xs text-white/70">{t.door.offlineBadge}</Text>
              )}
            </View>
          )}
        </View>

        {/* Pending offline scans */}
        {pending > 0 && (
          <Pressable
            onPress={async () => {
              try {
                await flushQueue(eventId);
              } catch {}
              refreshPending();
            }}
            className="mt-3 flex-row items-center justify-center rounded-xl border border-copper/50 bg-copper/10 py-2"
          >
            <Text className="font-mono text-sm text-copper-hi">
              {t.door.pendingSync(pending)} · {t.door.sync}
            </Text>
          </Pressable>
        )}

        {/* Manual name search (guestlist without a phone) */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.door.searchName}
          placeholderTextColor={palette.dim}
          className="mt-4 rounded-2xl border border-line bg-deep px-4 py-3 text-bone"
        />
        <FlatList
          data={matches}
          keyExtractor={(tk) => tk.id}
          className="mt-2"
          renderItem={({ item }) => (
            <View className="mb-2 flex-row items-center justify-between rounded-xl border border-line bg-card px-4 py-3">
              <View className="flex-1 pr-2">
                <Text className="text-bone">{item.holder_name}</Text>
                <Text className="font-mono text-xs text-dim">{item.product_name}</Text>
              </View>
              {item.status === "active" ? (
                <Pressable
                  onPress={async () => {
                    const next = await manualCheckIn(manifest!, item.id);
                    setManifest({ ...next });
                    refreshPending();
                  }}
                  className="rounded-full bg-seaglass px-4 py-1.5"
                >
                  <Text className="font-display text-xs font-bold text-abyss">{t.door.checkIn}</Text>
                </Pressable>
              ) : (
                <Text className="font-mono text-xs text-dim">{t.ticket.scanned}</Text>
              )}
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
