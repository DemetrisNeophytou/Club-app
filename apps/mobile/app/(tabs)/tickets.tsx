import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useI18n } from "../../lib/i18n";
import { formatEventTime } from "../../lib/format";
import { fetchMyTickets, type TicketWithEvent } from "../../lib/queries";
import { supabase } from "../../lib/supabase";

export default function TicketsScreen() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [tickets, setTickets] = useState<TicketWithEvent[] | null>(null);
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
            const mine = await fetchMyTickets();
            if (!cancelled) setTickets(mine);
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
          <Text className="mb-5 font-display text-3xl font-black text-bone">{t.tabs.tickets}</Text>
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
