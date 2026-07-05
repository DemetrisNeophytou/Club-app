"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../../lib/i18n";
import { supabase } from "../../../lib/supabase";
import { useVenue } from "../../../lib/venue-context";

type StripeState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "active" }
  | { kind: "error" };

// Venue settings (spec §6.1): Stripe Connect Express onboarding.
export default function SettingsPage() {
  const { venue, role } = useVenue();
  const { t } = useI18n();
  const [stripe, setStripe] = useState<StripeState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("connect-onboard", {
        body: { venue_id: venue.id, action: "status" },
      });
      if (error) throw error;
      if (!data.connected) setStripe({ kind: "none" });
      else if (data.charges_enabled) setStripe({ kind: "active" });
      else setStripe({ kind: "pending" });
    } catch {
      setStripe({ kind: "error" });
    }
  }, [venue.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const startOnboarding = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-onboard", {
        body: {
          venue_id: venue.id,
          return_url: window.location.href,
          refresh_url: window.location.href,
        },
      });
      if (error || !data?.url) throw error ?? new Error("no url");
      window.location.href = data.url; // Stripe-hosted onboarding
    } catch {
      setStripe({ kind: "error" });
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-2xl font-black">{t.venues.settings}</h1>

      <section className="rounded-2xl border border-line bg-deep p-5">
        <p className="font-display font-bold">{venue.name}</p>
        <p className="mt-1 font-mono text-xs text-dim">{venue.slug} · {venue.status}</p>
      </section>

      <section className="rounded-2xl border border-line bg-deep p-5">
        <h2 className="mb-3 font-display text-lg font-bold">{t.venues.payments}</h2>

        {stripe.kind === "loading" && <p className="text-dim">{t.common.loading}</p>}
        {stripe.kind === "error" && <p className="text-copper-hi">{t.common.error}</p>}

        {stripe.kind === "active" && (
          <p className="rounded-xl border border-seaglass/40 bg-seaglass/10 px-4 py-3 text-sm text-seaglass">
            ✓ {t.venues.stripeActive}
          </p>
        )}

        {stripe.kind === "none" && (
          <>
            <p className="mb-4 text-sm text-dim">{t.venues.stripeNone}</p>
            {role === "owner" && (
              <button
                onClick={startOnboarding}
                disabled={busy}
                className="rounded-xl bg-copper px-5 py-3 font-display text-sm font-bold text-abyss hover:opacity-90 disabled:opacity-50"
              >
                {t.venues.stripeConnect}
              </button>
            )}
          </>
        )}

        {stripe.kind === "pending" && (
          <>
            <p className="mb-4 text-sm text-copper-hi">{t.venues.stripePending}</p>
            {role === "owner" && (
              <button
                onClick={startOnboarding}
                disabled={busy}
                className="rounded-xl border border-copper px-5 py-3 font-display text-sm font-bold text-copper-hi hover:bg-copper/10 disabled:opacity-50"
              >
                {t.venues.stripeResume}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
