import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArchImage } from "../../components/ArchImage";
import { ProductRow } from "../../components/ProductRow";
import { useI18n } from "../../lib/i18n";
import { formatClock, formatEventTime } from "../../lib/format";
import { fetchEventBySlug, type FeedEvent } from "../../lib/queries";

// Event page (spec §5.2): arch hero, info strip, lineup, products, trust line.
export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { lang, t } = useI18n();
  const [event, setEvent] = useState<FeedEvent | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setEvent(await fetchEventBySlug(slug));
    } catch {
      setEvent(null);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (event === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-abyss">
        <Text className="text-dim">{t.common.loading}</Text>
      </View>
    );
  }
  if (event === null) {
    return (
      <View className="flex-1 items-center justify-center bg-abyss">
        <Text className="text-dim">{t.common.error}</Text>
        <Pressable onPress={load} className="mt-3 rounded-full border border-copper px-4 py-2">
          <Text className="text-copper-hi">{t.common.retry}</Text>
        </Pressable>
      </View>
    );
  }

  const description = lang === "el" ? event.description_el : event.description_en;
  const sorted = [...event.products].sort((a, b) => {
    const order = { ticket: 0, guestlist: 1, table: 2 } as const;
    return order[a.type] - order[b.type] || a.price_cents - b.price_cents;
  });
  // Strikethrough: latest sold-out/ended ticket release before an on-sale one.
  const now = Date.now();
  const endedTickets = sorted.filter(
    (p) =>
      p.type === "ticket" &&
      ((p.quota !== null && p.sold_count >= p.quota) ||
        (p.sales_end && Date.parse(p.sales_end) < now)),
  );
  const previousPrice = endedTickets.length
    ? Math.max(...endedTickets.map((p) => p.price_cents))
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Pressable onPress={() => router.back()} className="mb-4">
          <Text className="text-dim">←</Text>
        </Pressable>
        <ArchImage uri={event.cover_image} height={260} />

        <Text className="mt-5 font-display text-3xl font-black text-bone">{event.name}</Text>
        <Text className="mt-1 text-dim">
          {event.venue.name} · {formatEventTime(event.starts_at, lang)}
        </Text>

        {/* Info strip: doors / age / genre */}
        <View className="mt-4 flex-row rounded-2xl border border-line bg-deep p-3">
          <View className="flex-1 items-center border-r border-line">
            <Text className="text-xs text-dim">{t.event.doors}</Text>
            <Text className="mt-0.5 font-mono text-bone">{formatClock(event.doors_at, lang)}</Text>
          </View>
          <View className="flex-1 items-center border-r border-line">
            <Text className="text-xs text-dim">Age</Text>
            <Text className="mt-0.5 font-mono text-bone">
              {event.age_limit ? t.event.ageLimit(event.age_limit) : "—"}
            </Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-xs text-dim">Genre</Text>
            <Text className="mt-0.5 font-mono text-bone" numberOfLines={1}>
              {event.genre[0] ?? "—"}
            </Text>
          </View>
        </View>

        {/* Lineup */}
        {event.lineup.length > 0 && (
          <View className="mt-6">
            <Text className="mb-2 font-display text-lg font-bold text-bone">{t.event.lineup}</Text>
            {event.lineup.map((slot) => (
              <View key={`${slot.name}-${slot.time}`} className="flex-row justify-between py-1.5">
                <Text className="text-bone">{slot.name}</Text>
                <Text className="font-mono text-dim">{slot.time}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Products */}
        <View className="mt-6">
          {sorted.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              previousPrice={p.type === "ticket" && !endedTickets.includes(p) ? previousPrice : undefined}
              onPress={() => router.push({ pathname: "/checkout", params: { productId: p.id } })}
            />
          ))}
        </View>

        {/* Fair-ticketing trust line (spec §5.2) */}
        <Text className="mt-2 text-center text-xs leading-5 text-dim">{t.event.fairTicketing}</Text>

        {description && (
          <View className="mt-6">
            <Text className="mb-2 font-display text-lg font-bold text-bone">{t.event.about}</Text>
            <Text className="leading-6 text-dim">{description}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
