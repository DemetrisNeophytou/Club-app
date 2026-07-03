import { Tabs } from "expo-router";
import { palette } from "@portal/shared";
import { useI18n } from "../../lib/i18n";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.deep,
          borderTopColor: palette.line,
        },
        tabBarActiveTintColor: palette.copperHi,
        tabBarInactiveTintColor: palette.dim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.tonight }} />
      <Tabs.Screen name="search" options={{ title: t.tabs.search }} />
      <Tabs.Screen name="tickets" options={{ title: t.tabs.tickets }} />
      <Tabs.Screen name="profile" options={{ title: t.tabs.profile }} />
    </Tabs>
  );
}
