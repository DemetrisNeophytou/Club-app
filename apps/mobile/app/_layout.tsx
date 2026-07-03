import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { palette } from "@portal/shared";
import { I18nProvider } from "../lib/i18n";

export default function RootLayout() {
  return (
    <I18nProvider>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
        merchantIdentifier="merchant.app.portal.cy"
      >
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.abyss },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
        </Stack>
      </StripeProvider>
    </I18nProvider>
  );
}
