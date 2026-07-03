// sync-scans — offline door scans land here when the scanner reconnects
// (spec §7: "syncs scans when back online"). Also used for manual
// guestlist check-in by name (no QR nonce — staff identity is the auth).
//
// Idempotent: active→scanned only; a ticket already scanned reports
// "already_scanned" instead of failing the batch.

import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

interface IncomingScan {
  ticket_id: string;
  scanned_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { event_id, scans } = await req.json().catch(() => ({}));
  if (!event_id || !Array.isArray(scans) || scans.length === 0 || scans.length > 500) {
    return errorResponse("INVALID_INPUT");
  }

  const db = adminClient();

  const { data: event } = await db
    .from("events")
    .select("id, venue_id")
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

  const results: Array<{ ticket_id: string; result: string }> = [];
  for (const scan of scans as IncomingScan[]) {
    if (!scan?.ticket_id) continue;
    const scannedAt = scan.scanned_at ?? new Date().toISOString();
    const { data: updated } = await db
      .from("tickets")
      .update({ status: "scanned", scanned_at: scannedAt, scanned_by: user.id })
      .eq("id", scan.ticket_id)
      .eq("event_id", event_id) // a ticket for another event can't be marked here
      .eq("status", "active")
      .select("id");
    results.push({
      ticket_id: scan.ticket_id,
      result: updated && updated.length > 0 ? "ok" : "already_scanned",
    });
  }

  return json({ results });
});
