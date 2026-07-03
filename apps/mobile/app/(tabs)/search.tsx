import { useEffect, useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette } from "@portal/shared";
import { EventCard } from "../../components/EventCard";
import { useI18n } from "../../lib/i18n";
import { fetchFeed, type FeedEvent } from "../../lib/queries";

// Αναζήτηση — search events by name, venue or genre.
export default function SearchScreen() {
  const { t } = useI18n();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchFeed().then(setEvents).catch(() => setEvents([]));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.venue.name.toLowerCase().includes(q) ||
        e.genre.some((g) => g.toLowerCase().includes(q)),
    );
  }, [events, query]);

  return (
    <SafeAreaView className="flex-1 bg-abyss" edges={["top"]}>
      <View className="px-5 pt-2">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.tabs.search}
          placeholderTextColor={palette.dim}
          className="rounded-2xl border border-line bg-deep px-4 py-3 text-bone"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} />}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text className="py-16 text-center text-dim">{t.common.empty}</Text>}
      />
    </SafeAreaView>
  );
}
