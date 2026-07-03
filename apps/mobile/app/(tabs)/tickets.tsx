import { Text, View } from "react-native";
import { el } from "@portal/shared/i18n";

export default function TicketsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-abyss">
      <Text className="text-dim">{el.tabs.tickets}</Text>
    </View>
  );
}
