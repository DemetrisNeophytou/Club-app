// add-venue-member — the owner invites staff by email (spec §6.1).
// The invitee must already have a PORTAL account (they sign up first).

import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const ROLES = ["owner", "manager", "promoter", "door"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { venue_id, email, role } = await req.json().catch(() => ({}));
  if (!venue_id || typeof email !== "string" || !ROLES.includes(role)) {
    return errorResponse("INVALID_INPUT");
  }

  const db = adminClient();

  const { data: callerRole } = await db
    .from("venue_members")
    .select("role")
    .eq("venue_id", venue_id)
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!callerRole) return errorResponse("NOT_OWNER", 403);

  const { data: targetId } = await db.rpc("get_user_id_by_email", { p_email: email });
  if (!targetId) return errorResponse("USER_NOT_FOUND", 404);

  const { error } = await db
    .from("venue_members")
    .upsert({ user_id: targetId, venue_id, role }, { onConflict: "user_id,venue_id" });
  if (error) return errorResponse("ADD_FAILED", 500);

  return json({ ok: true, user_id: targetId });
});
