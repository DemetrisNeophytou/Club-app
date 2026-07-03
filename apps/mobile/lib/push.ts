import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * Register this device for push and store its Expo token (RLS: own rows
 * only). Best-effort: simulators and denied permissions no-op silently.
 * Note: remote push needs a development/EAS build — Expo Go won't deliver.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await supabase.from("push_tokens").upsert({
      token,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // push is a nice-to-have; the waitlist UI shows offers regardless
  }
}
