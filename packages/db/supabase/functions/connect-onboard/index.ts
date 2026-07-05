// connect-onboard — venue payments setup (spec §6.1, hard rule 7).
// Creates the venue's Stripe Connect Express account on first call and
// returns a hosted onboarding link; with action:"status" it reports
// whether charges are enabled yet.

import Stripe from "npm:stripe@17";
import { adminClient, getUser } from "../_shared/clients.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);

  const user = await getUser(req);
  if (!user) return errorResponse("NOT_AUTHENTICATED", 401);

  const { venue_id, action, return_url, refresh_url } = await req.json().catch(() => ({}));
  if (!venue_id) return errorResponse("INVALID_INPUT");

  const db = adminClient();

  const { data: membership } = await db
    .from("venue_members")
    .select("role")
    .eq("venue_id", venue_id)
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();
  if (!membership) return errorResponse("NOT_OWNER", 403);

  const { data: venue } = await db
    .from("venues")
    .select("id, name, stripe_account_id")
    .eq("id", venue_id)
    .single();

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

  if (action === "status") {
    if (!venue!.stripe_account_id) return json({ connected: false });
    const account = await stripe.accounts.retrieve(venue!.stripe_account_id);
    return json({
      connected: true,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
    });
  }

  if (typeof return_url !== "string" || typeof refresh_url !== "string") {
    return errorResponse("INVALID_INPUT");
  }

  let accountId = venue!.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "CY",
      email: user.email ?? undefined,
      business_profile: { name: venue!.name },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await db.from("venues").update({ stripe_account_id: accountId }).eq("id", venue_id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url,
    refresh_url,
  });

  return json({ url: link.url });
});
