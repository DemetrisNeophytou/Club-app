import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { palette } from "@portal/shared";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.abyss },
        }}
      />
    </>
  );
}
