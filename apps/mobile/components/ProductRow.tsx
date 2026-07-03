import { Pressable, Text, View } from "react-native";
import { formatPrice, ticketsLeft, type Product } from "@portal/shared";
import { useI18n } from "../lib/i18n";
import { formatClock } from "../lib/format";

export function ProductRow({
  product,
  previousPrice,
  onPress,
}: {
  product: Product;
  /** Sold-out earlier release price → strikethrough (spec §5.2). */
  previousPrice?: number;
  onPress: () => void;
}) {
  const { lang, t } = useI18n();
  const now = Date.now();

  const left = ticketsLeft(product);
  const notStarted = product.sales_start && Date.parse(product.sales_start) > now;
  const ended = product.sales_end && Date.parse(product.sales_end) < now;
  const glClosed = product.gl_cutoff_time && Date.parse(product.gl_cutoff_time) < now;
  const soldOut = left !== null && left === 0;
  const disabled = Boolean(soldOut || notStarted || ended || glClosed);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`mb-3 rounded-2xl border border-line bg-card p-4 ${disabled ? "opacity-45" : "active:opacity-80"}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-display text-base font-bold text-bone">{product.name}</Text>
          {product.type === "guestlist" && product.gl_cutoff_time && (
            <Text className="mt-0.5 text-xs text-seaglass">
              {t.event.guestlistUntil(formatClock(product.gl_cutoff_time, lang))}
            </Text>
          )}
          {product.type === "table" && product.table_min_spend_cents != null && (
            <Text className="mt-0.5 text-xs text-dim">
              {t.event.minSpend} {formatPrice(product.table_min_spend_cents)}
              {product.deposit_pct != null ? ` · ${t.event.deposit(product.deposit_pct)}` : ""}
            </Text>
          )}
          {!soldOut && left !== null && left > 0 && product.type === "ticket" && (
            <Text className="mt-0.5 font-mono text-xs text-dim">{t.feed.ticketsLeft(left)}</Text>
          )}
        </View>
        <View className="items-end">
          {previousPrice != null && (
            <Text className="font-mono text-xs text-dim line-through">
              {formatPrice(previousPrice)}
            </Text>
          )}
          <Text className="font-mono text-lg text-copper-hi">
            {soldOut
              ? t.feed.soldOut
              : product.type === "guestlist"
                ? t.common.free
                : product.type === "table" && product.table_min_spend_cents != null && product.deposit_pct != null
                  ? formatPrice(Math.round((product.table_min_spend_cents * product.deposit_pct) / 100))
                  : formatPrice(product.price_cents)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
