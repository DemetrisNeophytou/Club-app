import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Send an Expo push notification to all of a user's registered devices. */
export async function pushToUser(
  db: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", userId);
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token as string,
    title,
    body,
    data,
    sound: "default",
  }));

  try {
    await fetch("https://exp.host/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    // Push is best-effort — the in-app waitlist state is the source of truth.
    console.error("push send failed:", err);
  }
}
