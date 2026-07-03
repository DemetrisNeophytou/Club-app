import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useI18n } from "../../lib/i18n";
import { formatEventTime } from "../../lib/format";
import {
  fetchMyTickets,
  fetchMyWaitlist,
  type TicketWithEvent,
  type WaitlistWithRelations,
} from "../../lib/queries";
import { supabase } from "../../lib/supabase";

export default function TicketsScreen() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [tickets, setTickets] = useState<TicketWithEvent[] | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistWithRelations[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSignedIn(Boolean(data.session));
        if (data.session) {
          try {
            const [mine, wl] = await Promise.all([fetchMyTickets(), fetchMyWaitlist()]);
            if (!cancelled) {
              setTickets(mine);
              setWaitlist(wl);
            }
          } catch {
            if (!cancelled) setTickets([]);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (signedIn === false) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-abyss px-8">
        <Text className="text-center text-dim">{t.auth.signInFirst}</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          className="mt-4 rounded-full border border-copper px-5 py-2.5"
        >
          <Text className="text-copper-hi">{t.auth.signIn}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <FlatList
        data={tickets ?? []}
        keyExtractor={(tk) => tk.id}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <View>
            <Text className="mb-5 font-display text-3xl font-black text-bone">
              {t.tabs.tickets}
            </Text>
            {waitlist.length > 0 && (
              <View className="mb-6">
                <Text className="mb-2 font-display text-lg font-bold text-bone">
                  {t.waitlist.title}
                </Text>
                {waitlist.map((w) => {
                  const minsLeft = w.offer_expires_at
                    ? Math.max(0, Math.round((Date.parse(w.offer_expires_at) - Date.now()) / 60000))
                    : null;
                  const offered = w.status === "offered" && (minsLeft === null || minsLeft > 0);
                  return (
                    <Pressable
                      key={w.id}
                      disabled={!offered}
                      onPress={() =>
                        router.push({
                          pathname: "/checkout",
                          params: { productId: w.product_id, waitlistId: w.id },
                        })
                      }
                      className={`mb-2 rounded-2xl border p-4 ${
                        offered ? "border-seaglass/60 bg-seaglass/10" : "border-line bg-card"
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="font-display font-bold text-bone">{w.event.name}</Text>
                          <Text className="mt-0.5 text-sm text-dim">{w.product.name}</Text>
                        </View>
                        {offered ? (
                          <View className="items-end">
                            <Text className="font-display text-sm font-bold text-seaglass">
                              {t.waitlist.buyNow}
                            </Text>
                            {minsLeft !== null && (
                              <Text className="font-mono text-xs text-dim">
                                {t.waitlist.minsLeft(minsLeft)}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <Text className="font-mono text-xs text-dim">
                            {t.waitlist.position(w.position)}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text className="py-16 text-center text-dim">
            {tickets === null ? t.common.loading : t.common.empty}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/ticket/${item.id}`)}
            className="mb-3 rounded-2xl border border-line bg-card p-4 active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-display text-base font-bold text-bone">{item.event.name}</Text>
                <Text className="mt-0.5 text-sm text-dim">
                  {formatEventTime(item.event.starts_at, lang)} · {item.product.name}
                </Text>
              </View>
              <Text
                className={`font-mono text-xs ${
                  item.status === "active"
                    ? "text-seaglass"
                    : item.status === "scanned"
                      ? "text-dim"
                      : "text-copper-hi"
                }`}
              >
                {item.status === "active"
                  ? t.ticket.active
                  : item.status === "scanned"
                    ? t.ticket.scanned
                    : item.status}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
