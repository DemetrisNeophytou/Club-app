// return-ticket — hard rule 2: no secondary market. A returned ticket goes
// to the waitlist FIFO; the returner is refunded when (and only when) it
// is resold — see stripe-webhook. The quota slot stays claimed, so the
// tickets-left counter never lies.

import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { pairWaitlist } from "../_shared/waitlist.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { ticket_id } = await req.json().catch(() => ({}));
  if (!ticket_id) return errorResponse("INVALID_INPUT");

  const db = adminClient();

  const { data: ticket } = await db
    .from("tickets")
    .select("id, user_id, product_id, status, event:events(starts_at)")
    .eq("id", ticket_id)
    .maybeSingle();
  if (!ticket || ticket.user_id !== user.id) return errorResponse("TICKET_NOT_FOUND", 404);
  if (ticket.status !== "active") return errorResponse("NOT_RETURNABLE", 409);

  const startsAt = (ticket.event as unknown as { starts_at: string }).starts_at;
  if (Date.parse(startsAt) < Date.now()) return errorResponse("EVENT_STARTED", 409);

  // Atomic: a double-tap or concurrent scan can't return the same ticket twice.
  const { data: updated } = await db
    .from("tickets")
    .update({ status: "returned" })
    .eq("id", ticket.id)
    .eq("status", "active")
    .select("id");
  if (!updated || updated.length === 0) return errorResponse("NOT_RETURNABLE", 409);

  // Offer it to the first person in line right away.
  await pairWaitlist(db, ticket.product_id);

  return json({ ok: true });
});
