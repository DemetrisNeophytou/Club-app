import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Event } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import { formatEventTime } from "../../lib/format";
import { supabase } from "../../lib/supabase";

// Door mode entry (spec §7): staff pick tonight's event.
export default function DoorEventPicker() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: memberships } = await supabase.from("venue_members").select("venue_id");
        const venueIds = (memberships ?? []).map((m) => m.venue_id as string);
        if (venueIds.length === 0) {
          setEvents([]);
          return;
        }
        const since = new Date(Date.now() - 12 * 3600_000).toISOString();
        const { data } = await supabase
          .from("events")
          .select("*")
          .in("venue_id", venueIds)
          .gte("doors_at", since)
          .order("doors_at", { ascending: true })
          .limit(20);
        setEvents((data ?? []) as Event[]);
      } catch {
        setEvents([]);
      }
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <View className="flex-1 px-5 pt-2">
        <Pressable onPress={() => router.back()} className="mb-2">
          <Text className="text-dim">←</Text>
        </Pressable>
        <Text className="mb-1 font-display text-3xl font-black text-bone">{t.door.title}</Text>
        <Text className="mb-5 text-dim">{t.door.selectEvent}</Text>
        <FlatList
          data={events ?? []}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={
            <Text className="py-16 text-center text-dim">
              {events === null ? t.common.loading : t.common.empty}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/door/${item.id}`)}
              className="mb-3 rounded-2xl border border-line bg-card p-4 active:opacity-80"
            >
              <Text className="font-display text-base font-bold text-bone">{item.name}</Text>
              <Text className="mt-0.5 text-sm text-dim">{formatEventTime(item.doors_at, lang)}</Text>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
