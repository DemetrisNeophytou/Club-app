// cancel-table — hard rule 5: table deposits refund in full only when the
// booking is cancelled MORE than 48h before the event starts. Inside 48h
// the venue keeps the deposit, so in-app cancellation is refused.

import Stripe from "npm:stripe@17";
import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const CUTOFF_HOURS = 48;

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
    .select(
      "id, user_id, status, order_id, product_id, product:products(type), event:events(starts_at)",
    )
    .eq("id", ticket_id)
    .maybeSingle();
  if (!ticket || ticket.user_id !== user.id) return errorResponse("TICKET_NOT_FOUND", 404);
  if (ticket.status !== "active") return errorResponse("NOT_CANCELLABLE", 409);

  const product = ticket.product as unknown as { type: string };
  if (product.type !== "table") return errorResponse("NOT_A_TABLE", 409);

  const startsAt = Date.parse((ticket.event as unknown as { starts_at: string }).starts_at);
  if (startsAt - Date.now() < CUTOFF_HOURS * 3600_000) {
    return errorResponse("INSIDE_48H_NO_REFUND", 409);
  }

  const { data: cancelled } = await db
    .from("tickets")
    .update({ status: "refunded" })
    .eq("id", ticket.id)
    .eq("status", "active")
    .select("id");
  if (!cancelled || cancelled.length === 0) return errorResponse("NOT_CANCELLABLE", 409);

  // Full deposit refund + the table goes back on sale.
  const { data: order } = await db
    .from("orders")
    .select("id, amount_cents, stripe_payment_intent_id")
    .eq("id", ticket.order_id)
    .maybeSingle();
  if (order?.stripe_payment_intent_id && order.amount_cents > 0) {
    try {
      await db.from("orders").update({ status: "refunded" }).eq("id", order.id);
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        refund_application_fee: true,
        reverse_transfer: true,
      });
    } catch (err) {
      console.error("table refund failed for order", order.id, err);
    }
  }
  await db.rpc("release_product_quota", { p_product_id: ticket.product_id, p_qty: 1 });

  return json({ ok: true });
});
