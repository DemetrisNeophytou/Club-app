// cancel-event — hard rule 6: event cancellation = automatic full refund
// to everyone. Owner/manager only. Idempotent per order.

import Stripe from "npm:stripe@17";
import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { pushToUser } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { event_id } = await req.json().catch(() => ({}));
  if (!event_id) return errorResponse("INVALID_INPUT");

  const db = adminClient();

  const { data: event } = await db
    .from("events")
    .select("id, name, venue_id, status")
    .eq("id", event_id)
    .maybeSingle();
  if (!event) return errorResponse("EVENT_NOT_FOUND", 404);
  if (event.status === "cancelled") return json({ ok: true, already: true });

  const { data: membership } = await db
    .from("venue_members")
    .select("role")
    .eq("venue_id", event.venue_id)
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .maybeSingle();
  if (!membership) return errorResponse("NOT_ALLOWED", 403);

  await db.from("events").update({ status: "cancelled" }).eq("id", event.id);

  // Refund every paid order (guestlist orders have no payment intent).
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const { data: orders } = await db
    .from("orders")
    .select("id, user_id, amount_cents, stripe_payment_intent_id")
    .eq("event_id", event.id)
    .eq("status", "paid");

  let refunded = 0;
  const failures: string[] = [];
  for (const order of orders ?? []) {
    try {
      if (order.stripe_payment_intent_id && order.amount_cents > 0) {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          refund_application_fee: true,
          reverse_transfer: true,
        });
      }
      await db.from("orders").update({ status: "refunded" }).eq("id", order.id);
      refunded++;
    } catch (err) {
      console.error("refund failed for order", order.id, err);
      failures.push(order.id);
    }
  }

  // Kill the QRs and tell everyone.
  await db
    .from("tickets")
    .update({ status: "refunded" })
    .eq("event_id", event.id)
    .in("status", ["active", "returned"]);

  const { data: holders } = await db
    .from("orders")
    .select("user_id")
    .eq("event_id", event.id)
    .not("user_id", "is", null);
  const userIds = [...new Set((holders ?? []).map((h) => h.user_id as string))];
  for (const uid of userIds) {
    await pushToUser(
      db,
      uid,
      event.name,
      "Το event ακυρώθηκε. Τα χρήματά σου επιστρέφονται αυτόματα. / Event cancelled — automatic full refund.",
      { type: "event_cancelled", event_id: event.id },
    );
  }

  return json({ ok: true, refunded, failed_orders: failures });
});
