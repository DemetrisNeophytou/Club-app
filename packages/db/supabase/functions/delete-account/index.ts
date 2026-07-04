// delete-account — GDPR right to erasure (spec §9). The auth user and
// profile are destroyed; tickets/orders stay as anonymized financial
// records (user_id → null via ON DELETE SET NULL).

import { createClient } from "npm:@supabase/supabase-js@2";
import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const db = adminClient();

  // A venue's sole owner can't vanish and leave the venue orphaned.
  const { data: ownerships } = await db
    .from("venue_members")
    .select("venue_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  for (const o of ownerships ?? []) {
    const { count } = await db
      .from("venue_members")
      .select("user_id", { count: "exact", head: true })
      .eq("venue_id", o.venue_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) return errorResponse("SOLE_VENUE_OWNER", 409);
  }

  const authAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { error } = await authAdmin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete user failed:", error);
    return errorResponse("DELETE_FAILED", 500);
  }

  return json({ ok: true });
});
