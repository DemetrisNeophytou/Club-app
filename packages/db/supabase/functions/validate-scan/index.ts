// validate-scan — the door decides here, not on the phone (spec §7, §9).
//
// Scanner (venue member) posts { payload, event_id }. We verify:
//   1. the scanner belongs to the event's venue,
//   2. the ticket exists, is for this event, and its rotating nonce is
//      fresh (screenshot = stale nonce = rejected),
//   3. state transitions atomically active→scanned (double-scan safe).
//
// Results mirror the Door app UI: ok / already_scanned / invalid / expired.

import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { nonceMatches } from "../_shared/nonce.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { payload, event_id } = await req.json().catch(() => ({}));
  if (typeof payload !== "string" || !event_id) return errorResponse("INVALID_INPUT");

  const db = adminClient();

  // Scanner must be staff of THIS event's venue (any role, incl. door).
  const { data: event } = await db
    .from("events")
    .select("id, venue_id, doors_at")
    .eq("id", event_id)
    .maybeSingle();
  if (!event) return errorResponse("EVENT_NOT_FOUND", 404);

  const { data: membership } = await db
    .from("venue_members")
    .select("role")
    .eq("venue_id", event.venue_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return errorResponse("NOT_VENUE_STAFF", 403);

  // Payload: PORTAL1.<ticket_id>.<nonce>
  const [version, ticketId, nonce] = payload.split(".");
  if (version !== "PORTAL1" || !ticketId || !nonce) {
    return json({ result: "invalid" });
  }

  const { data: ticket } = await db
    .from("tickets")
    .select(
      "id, event_id, qr_secret, status, scanned_at, scanned_by, user_id, product:products(type, name, gl_cutoff_time)",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket || ticket.event_id !== event_id) return json({ result: "invalid" });

  const product = ticket.product as unknown as {
    type: string;
    name: string;
    gl_cutoff_time: string | null;
  };

  if (ticket.status === "scanned") {
    return json({
      result: "already_scanned",
      scanned_at: ticket.scanned_at,
      scanned_by: ticket.scanned_by,
    });
  }
  if (ticket.status !== "active") return json({ result: "invalid" });

  // Guestlist after cutoff = expired (hard rule 4).
  if (
    product.type === "guestlist" &&
    product.gl_cutoff_time &&
    Date.now() > Date.parse(product.gl_cutoff_time)
  ) {
    return json({ result: "expired" });
  }

  // Screenshot defence: nonce must match the current 60s window (±1).
  if (!(await nonceMatches(ticket.qr_secret, nonce))) {
    return json({ result: "invalid" });
  }

  // Atomic transition — a concurrent scan of the same ticket loses.
  const { data: scanned } = await db
    .from("tickets")
    .update({ status: "scanned", scanned_at: new Date().toISOString(), scanned_by: user.id })
    .eq("id", ticket.id)
    .eq("status", "active")
    .select();
  if (!scanned || scanned.length === 0) {
    return json({ result: "already_scanned" });
  }

  const { data: owner } = await db
    .from("profiles")
    .select("name")
    .eq("id", ticket.user_id)
    .maybeSingle();

  return json({
    result: "ok",
    name: owner?.name ?? null,
    product_type: product.type,
    product_name: product.name,
  });
});
