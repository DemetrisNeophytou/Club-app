// create-payment-intent — the only door to a purchase (spec §8 Phase 1.3).
//
// Flow: authenticate → claim quota (row-locked, in Postgres) → create a
// pending order → Stripe PaymentIntent as a destination charge to the
// venue's Connect account with our application fee (hard rule 7).
// Guestlist (free) skips Stripe and issues tickets immediately.
//
// The client NEVER sends an amount — everything is computed here from the
// product row (spec §9: never trust the client).

import Stripe from "npm:stripe@17";
import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const COMMISSION_PCT = 10; // 10% of face value (spec §1)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { product_id, qty: rawQty } = await req.json().catch(() => ({}));
  const qty = Number(rawQty ?? 1);
  if (!product_id || !Number.isInteger(qty) || qty < 1 || qty > 10) {
    return errorResponse("INVALID_INPUT");
  }

  const db = adminClient();

  // Tables are booked one at a time.
  const { data: productPeek } = await db
    .from("products")
    .select("type")
    .eq("id", product_id)
    .maybeSingle();
  if (!productPeek) return errorResponse("PRODUCT_NOT_FOUND", 404);
  const effectiveQty = productPeek.type === "table" ? 1 : qty;

  // Atomically claim quota — the Postgres function enforces release windows,
  // per-order limits and the honest counter under a row lock.
  const { data: product, error: claimError } = await db.rpc("claim_product_quota", {
    p_product_id: product_id,
    p_qty: effectiveQty,
  });
  if (claimError) {
    return errorResponse(claimError.message.split("\n")[0] ?? "CLAIM_FAILED", 409);
  }

  const release = () =>
    db.rpc("release_product_quota", { p_product_id: product_id, p_qty: effectiveQty });

  try {
    const { data: event } = await db
      .from("events")
      .select("id, name, venue:venues(id, name, stripe_account_id)")
      .eq("id", product.event_id)
      .single();
    const venue = event!.venue as unknown as { id: string; name: string; stripe_account_id: string | null };

    // ── Free guestlist: no Stripe, issue immediately (spec §4 rule 4) ──
    if (product.type === "guestlist") {
      const { data: order, error: orderError } = await db
        .from("orders")
        .insert({
          user_id: user.id,
          event_id: product.event_id,
          product_id: product.id,
          qty: effectiveQty,
          amount_cents: 0,
          fee_cents: 0,
          status: "paid",
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const { error: ticketError } = await db.from("tickets").insert(
        Array.from({ length: effectiveQty }, () => ({
          order_id: order.id,
          event_id: product.event_id,
          product_id: product.id,
          user_id: user.id,
        })),
      );
      if (ticketError) throw ticketError;

      return json({ free: true, order_id: order.id });
    }

    // ── Paid: ticket or table deposit ──
    if (!venue.stripe_account_id) {
      await release();
      return errorResponse("VENUE_NOT_ONBOARDED", 409);
    }

    let amountCents: number;
    let applicationFeeCents: number;
    let feeCents: number;

    if (product.type === "table") {
      // 30% (deposit_pct) of min spend now; our fee = 10% of min spend,
      // charged on the deposit (spec §1, hard rule 5).
      amountCents = Math.round(
        (product.table_min_spend_cents * product.deposit_pct) / 100,
      );
      applicationFeeCents = Math.round((product.table_min_spend_cents * COMMISSION_PCT) / 100);
      feeCents = 0;
    } else {
      // Ticket: price includes the €1 booking fee (hard rule 1).
      // Our cut = 10% of face value + the booking fee (spec §1).
      const faceValue = product.price_cents - product.fee_cents;
      amountCents = product.price_cents * effectiveQty;
      feeCents = product.fee_cents * effectiveQty;
      applicationFeeCents =
        Math.round((faceValue * COMMISSION_PCT) / 100) * effectiveQty + feeCents;
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        user_id: user.id,
        event_id: product.event_id,
        product_id: product.id,
        qty: effectiveQty,
        amount_cents: amountCents,
        fee_cents: feeCents,
        status: "pending",
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFeeCents,
      transfer_data: { destination: venue.stripe_account_id },
      metadata: {
        order_id: order.id,
        product_id: product.id,
        event_name: event!.name,
        qty: String(effectiveQty),
      },
    });

    await db
      .from("orders")
      .update({ stripe_payment_intent_id: intent.id })
      .eq("id", order.id);

    return json({ client_secret: intent.client_secret, order_id: order.id });
  } catch (err) {
    console.error("create-payment-intent failed:", err);
    await release();
    return errorResponse("PAYMENT_SETUP_FAILED", 500);
  }
});
