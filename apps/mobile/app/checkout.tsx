import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { formatPrice, palette, type Product } from "@portal/shared";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";

type Phase = "idle" | "paying" | "done" | "error";

/**
 * Checkout bottom sheet (spec §5.3): qty stepper → total + fee note → pay.
 * Two taps max: (1) adjust qty if needed, (2) Pay.
 * The server (create-payment-intent) is the only source of truth for the
 * amount — the total shown here is display-only.
 */
export default function CheckoutScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle()
      .then(({ data }) => setProduct(data as Product | null));
  }, [productId]);

  const pay = useCallback(async () => {
    if (!product) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage(t.auth.signInFirst);
      return;
    }

    setPhase("paying");
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: { product_id: product.id, qty },
      });
      if (error) throw error;

      if (data.free) {
        // Guestlist: no charge, tickets issued server-side immediately.
        setPhase("done");
        return;
      }

      const init = await initPaymentSheet({
        paymentIntentClientSecret: data.client_secret,
        merchantDisplayName: "PORTAL",
        applePay: { merchantCountryCode: "CY" },
        googlePay: { merchantCountryCode: "CY", currencyCode: "EUR", testEnv: true },
        style: "alwaysDark",
      });
      if (init.error) throw init.error;

      const result = await presentPaymentSheet();
      if (result.error) {
        if (result.error.code !== "Canceled") throw result.error;
        setPhase("idle");
        return;
      }
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }, [product, qty, initPaymentSheet, presentPaymentSheet, t]);

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-deep">
        <ActivityIndicator color={palette.copper} />
      </View>
    );
  }

  const maxQty = Math.min(product.per_order_limit ?? 10, 10);
  const isTable = product.type === "table";
  const unitPrice =
    isTable && product.table_min_spend_cents != null && product.deposit_pct != null
      ? Math.round((product.table_min_spend_cents * product.deposit_pct) / 100)
      : product.price_cents;
  const total = unitPrice * (isTable ? 1 : qty);
  const feeTotal = product.fee_cents * (isTable ? 1 : qty);

  return (
    <View className="flex-1 justify-end bg-abyss/60">
      <View className="rounded-t-3xl border-t border-line bg-deep p-6 pb-10">
        <View className="mb-4 h-1 w-10 self-center rounded-full bg-line" />
        <Text className="font-display text-xl font-bold text-bone">{product.name}</Text>

        {phase === "done" ? (
          <View className="items-center py-8">
            <Text className="text-center text-lg text-seaglass">{t.checkout.success}</Text>
            <Pressable
              onPress={() => router.replace("/(tabs)/tickets")}
              className="mt-6 w-full items-center rounded-2xl bg-copper py-4"
            >
              <Text className="font-display font-bold text-abyss">{t.tabs.tickets}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Quantity stepper (tables book one at a time) */}
            {!isTable && (
              <View className="mt-5 flex-row items-center justify-center">
                <Pressable
                  onPress={() => setQty(Math.max(1, qty - 1))}
                  className="h-11 w-11 items-center justify-center rounded-full border border-line"
                >
                  <Text className="text-xl text-bone">−</Text>
                </Pressable>
                <Text className="mx-8 font-mono text-2xl text-bone">{qty}</Text>
                <Pressable
                  onPress={() => setQty(Math.min(maxQty, qty + 1))}
                  className="h-11 w-11 items-center justify-center rounded-full border border-line"
                >
                  <Text className="text-xl text-bone">+</Text>
                </Pressable>
              </View>
            )}

            <View className="mt-6 flex-row items-baseline justify-between">
              <Text className="text-dim">{t.checkout.total}</Text>
              <Text className="font-mono text-2xl text-copper-hi">
                {total === 0 ? t.common.free : formatPrice(total)}
              </Text>
            </View>
            {feeTotal > 0 && (
              /* Price shown = price paid (hard rule 1); the fee is inside it, stated plainly. */
              <Text className="mt-1 text-right text-xs text-dim">
                {t.checkout.feeIncluded(formatPrice(feeTotal))}
              </Text>
            )}

            {message && <Text className="mt-3 text-center text-sm text-copper-hi">{message}</Text>}
            {phase === "error" && (
              <Text className="mt-3 text-center text-sm text-copper-hi">{t.common.error}</Text>
            )}

            <Pressable
              onPress={pay}
              disabled={phase === "paying"}
              className={`mt-5 items-center rounded-2xl bg-copper py-4 ${phase === "paying" ? "opacity-60" : "active:opacity-85"}`}
            >
              {phase === "paying" ? (
                <ActivityIndicator color={palette.abyss} />
              ) : (
                <Text className="font-display text-base font-bold text-abyss">{t.checkout.pay}</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
