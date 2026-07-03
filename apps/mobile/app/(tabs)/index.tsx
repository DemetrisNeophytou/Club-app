import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { City } from "@portal/shared";
import { palette } from "@portal/shared";
import { EventCard } from "../../components/EventCard";
import { useI18n } from "../../lib/i18n";
import { isThisWeekend, isToday, isTomorrow } from "../../lib/format";
import { fetchCities, fetchFeed, type FeedEvent } from "../../lib/queries";

type DateFilter = "tonight" | "tomorrow" | "weekend" | null;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-3.5 py-1.5 ${
        active ? "border-copper bg-copper/15" : "border-line bg-deep"
      }`}
    >
      <Text className={`text-sm ${active ? "text-copper-hi" : "text-dim"}`}>{label}</Text>
    </Pressable>
  );
}

// Απόψε — the Tonight feed (spec §5.1)
export default function TonightScreen() {
  const { lang, t } = useI18n();
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const [feed, allCities] = await Promise.all([fetchFeed(), fetchCities()]);
      setEvents(feed);
      setCities(allCities);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      if (cityId && e.venue.city_id !== cityId) return false;
      if (dateFilter === "tonight" && !isToday(e.starts_at)) return false;
      if (dateFilter === "tomorrow" && !isTomorrow(e.starts_at)) return false;
      if (dateFilter === "weekend" && !isThisWeekend(e.starts_at)) return false;
      return true;
    });
  }, [events, cityId, dateFilter]);

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.copper} />
        }
        ListHeaderComponent={
          <View className="mb-5">
            <Text className="font-display text-3xl font-black tracking-widest text-bone">
              PORTAL
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-4"
              data={[{ id: null as string | null, label: t.feed.allCities }].concat(
                cities.map((c) => ({ id: c.id, label: lang === "el" ? c.name_el : c.name_en })),
              )}
              keyExtractor={(c) => c.id ?? "all"}
              renderItem={({ item }) => (
                <Chip label={item.label} active={cityId === item.id} onPress={() => setCityId(item.id)} />
              )}
            />
            <View className="mt-3 flex-row">
              {(
                [
                  ["tonight", t.feed.tonight],
                  ["tomorrow", t.feed.tomorrow],
                  ["weekend", t.feed.weekend],
                ] as const
              ).map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  active={dateFilter === key}
                  onPress={() => setDateFilter(dateFilter === key ? null : key)}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-dim">
              {error ? t.common.error : events === null ? t.common.loading : t.common.empty}
            </Text>
            {error && (
              <Pressable onPress={load} className="mt-3 rounded-full border border-copper px-4 py-2">
                <Text className="text-copper-hi">{t.common.retry}</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}
