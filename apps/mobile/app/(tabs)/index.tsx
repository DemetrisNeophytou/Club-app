import { Text, View } from "react-native";
import { el } from "@portal/shared/i18n";

// Απόψε — Tonight feed (Phase 1 step 2 fills this in from Supabase).
export default function TonightScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-abyss">
      <Text className="font-display text-3xl font-black tracking-widest text-bone">
        PORTAL
      </Text>
      <Text className="mt-2 text-dim">{el.feed.tonight}</Text>
    </View>
  );
}
