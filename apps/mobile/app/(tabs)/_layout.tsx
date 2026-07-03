import { Tabs } from "expo-router";
import { palette } from "@portal/shared";
import { el } from "@portal/shared/i18n";

export default function TabsLayout() {
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
      <Tabs.Screen name="index" options={{ title: el.tabs.tonight }} />
      <Tabs.Screen name="search" options={{ title: el.tabs.search }} />
      <Tabs.Screen name="tickets" options={{ title: el.tabs.tickets }} />
      <Tabs.Screen name="profile" options={{ title: el.tabs.profile }} />
    </Tabs>
  );
}
