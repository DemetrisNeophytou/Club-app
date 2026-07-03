"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { City } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import { fetchCities, slugify } from "../../lib/data";
import { supabase } from "../../lib/supabase";

// Venue onboarding (spec §6.1, minus Stripe Connect for now):
// create venue (draft) → bootstrap self as owner → dashboard.
export default function OnboardingPage() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const [cities, setCities] = useState<City[]>([]);
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchCities().then((c) => {
      setCities(c);
      if (c.length > 0) setCityId(c[0]!.id);
    });
  }, []);

  const create = async () => {
    setBusy(true);
    setError(false);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("no user");

      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .insert({
          name: name.trim(),
          slug: slugify(name),
          city_id: cityId,
          status: "draft",
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (venueError) throw venueError;

      // RLS bootstrap policy: the creator may add themselves as owner.
      const { error: memberError } = await supabase.from("venue_members").insert({
        user_id: userData.user.id,
        venue_id: venue.id,
        role: "owner",
      });
      if (memberError) throw memberError;

      router.replace("/dashboard");
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        className="w-full max-w-sm rounded-2xl border border-line bg-deep p-6"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <h1 className="mb-6 font-display text-2xl font-black">{t.venues.createVenue}</h1>

        <label className="mb-2 block text-sm text-dim">{t.venues.venueName}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-line bg-card px-4 py-3 text-bone outline-none focus:border-copper"
          required
          minLength={2}
        />

        <label className="mb-2 block text-sm text-dim">{t.venues.city}</label>
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="mb-6 w-full rounded-xl border border-line bg-card px-4 py-3 text-bone outline-none focus:border-copper"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === "el" ? c.name_el : c.name_en}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full rounded-xl bg-copper py-3 font-display font-bold text-abyss hover:opacity-90 disabled:opacity-50"
        >
          {t.venues.create}
        </button>
        {error && <p className="mt-3 text-center text-sm text-copper-hi">{t.common.error}</p>}
      </form>
    </main>
  );
}
