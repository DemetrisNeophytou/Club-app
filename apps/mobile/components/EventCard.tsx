import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatPrice, ticketsLeft } from "@portal/shared";
import type { FeedEvent } from "../lib/queries";
import { useI18n } from "../lib/i18n";
import { formatEventTime } from "../lib/format";
import { ArchImage } from "./ArchImage";
import { Badge } from "./Badge";

const SELLING_FAST_THRESHOLD = 0.15; // ≤15% of quota left

export function EventCard({ event }: { event: FeedEvent }) {
  const router = useRouter();
  const { lang, t } = useI18n();

  const now = Date.now();
  const onSaleTickets = event.products.filter(
    (p) =>
      p.type === "ticket" &&
      (!p.sales_start || Date.parse(p.sales_start) <= now) &&
      (!p.sales_end || Date.parse(p.sales_end) >= now),
  );
  const guestlistOpen = event.products.some(
    (p) => p.type === "guestlist" && (!p.gl_cutoff_time || Date.parse(p.gl_cutoff_time) > now),
  );

  // Honest counter (spec §9): real quota - sold across on-sale releases.
  const left = onSaleTickets.reduce((sum, p) => sum + (ticketsLeft(p) ?? 0), 0);
  const totalQuota = onSaleTickets.reduce((sum, p) => sum + (p.quota ?? 0), 0);
  const soldOut = event.status === "soldout" || (onSaleTickets.length > 0 && left === 0);
  const sellingFast = !soldOut && totalQuota > 0 && left / totalQuota <= SELLING_FAST_THRESHOLD;
  const minPrice = onSaleTickets.length
    ? Math.min(...onSaleTickets.map((p) => p.price_cents))
    : null;

  return (
    <Pressable
      className="mb-6 active:opacity-80"
      onPress={() => router.push(`/event/${event.slug}`)}
    >
      <ArchImage uri={event.cover_image} />
      <View className="mt-3 flex-row flex-wrap gap-2">
        {soldOut && <Badge label={t.feed.soldOut} tone="dim" />}
        {!soldOut && sellingFast && <Badge label={t.feed.sellingFast} tone="copper" />}
        {!soldOut && !sellingFast && left > 0 && (
          <Badge label={t.feed.ticketsLeft(left)} tone="copper" />
        )}
        {guestlistOpen && !soldOut && <Badge label={t.feed.guestlistOpen} tone="seaglass" />}
      </View>
      <Text className="mt-2 font-display text-xl font-black text-bone">{event.name}</Text>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-sm text-dim">
          {event.venue.name} · {formatEventTime(event.starts_at, lang)}
        </Text>
        {minPrice !== null && (
          <Text className="font-mono text-sm text-copper-hi">
            {t.common.from} {formatPrice(minPrice)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
