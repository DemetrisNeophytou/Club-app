// stripe-webhook — issue-tickets on payment success (spec §8 Phase 1.3).
//
// Stripe calls this endpoint (no user JWT — verify_jwt is off in
// config.toml); authenticity comes from the webhook signature instead.
// Idempotent: a redelivered event finds the order already paid and no-ops.

import Stripe from "npm:stripe@17";
import { adminClient } from "../_shared/clients.ts";
import { errorResponse, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const signature = req.headers.get("stripe-signature");
  if (!signature) return errorResponse("MISSING_SIGNATURE", 400);

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch {
    return errorResponse("INVALID_SIGNATURE", 400);
  }

  const db = adminClient();

  if (
    stripeEvent.type === "payment_intent.succeeded" ||
    stripeEvent.type === "payment_intent.payment_failed" ||
    stripeEvent.type === "payment_intent.canceled"
  ) {
    const intent = stripeEvent.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.order_id;
    if (!orderId) return json({ received: true });

    if (stripeEvent.type === "payment_intent.succeeded") {
      // Claim the order pending→paid atomically; 0 rows = already processed.
      const { data: paidOrders, error } = await db
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId)
        .eq("status", "pending")
        .select();
      if (error) return errorResponse("ORDER_UPDATE_FAILED", 500);
      const order = paidOrders?.[0];
      if (!order) return json({ received: true, duplicate: true });

      const { error: ticketError } = await db.from("tickets").insert(
        Array.from({ length: order.qty }, () => ({
          order_id: order.id,
          event_id: order.event_id,
          product_id: order.product_id,
          user_id: order.user_id,
        })),
      );
      if (ticketError) {
        console.error("ticket issuance failed for order", order.id, ticketError);
        return errorResponse("TICKET_ISSUE_FAILED", 500); // Stripe retries
      }
    } else {
      // Failed/canceled: mark it and give the seats back (once).
      const { data: failedOrders } = await db
        .from("orders")
        .update({ status: "failed" })
        .eq("id", orderId)
        .eq("status", "pending")
        .select();
      const order = failedOrders?.[0];
      if (order) {
        await db.rpc("release_product_quota", {
          p_product_id: order.product_id,
          p_qty: order.qty,
        });
      }
    }
  }

  return json({ received: true });
});
