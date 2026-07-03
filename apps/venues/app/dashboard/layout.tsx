"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AppLang } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import { fetchMyVenue, type MyVenue } from "../../lib/data";
import { supabase } from "../../lib/supabase";

const VenueContext = createContext<MyVenue | null>(null);
export function useVenue(): MyVenue {
  const v = useContext(VenueContext);
  if (!v) throw new Error("useVenue outside dashboard");
  return v;
}

// Auth + membership guard: no session → login; no venue → onboarding.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [my, setMy] = useState<MyVenue | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/");
        return;
      }
      try {
        const venue = await fetchMyVenue();
        if (!venue) router.replace("/onboarding");
        else setMy(venue);
      } catch {
        setMy(null);
      }
    })();
  }, [router]);

  if (my === undefined) {
    return <main className="flex min-h-screen items-center justify-center text-dim">…</main>;
  }
  if (my === null) {
    return <main className="flex min-h-screen items-center justify-center text-dim">{t.common.error}</main>;
  }

  return (
    <VenueContext.Provider value={my}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="flex items-center justify-between border-b border-line bg-deep px-5 py-4 md:min-h-screen md:w-60 md:flex-col md:items-start md:border-b-0 md:border-r">
          <div>
            <Link href="/dashboard" className="font-display text-lg font-black tracking-widest">
              PORTAL <span className="text-copper">VENUES</span>
            </Link>
            <p className="mt-1 text-sm text-dim">{my.venue.name}</p>
          </div>
          <nav className="flex gap-4 md:mt-8 md:flex-col md:gap-3">
            <Link href="/dashboard" className="text-sm text-dim hover:text-bone">
              {t.venues.events}
            </Link>
          </nav>
          <div className="flex items-center gap-3 md:mt-auto">
            {(["el", "en"] as AppLang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`text-xs ${lang === l ? "text-copper-hi" : "text-dim"}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/");
              }}
              className="text-xs text-dim hover:text-bone"
            >
              {t.auth.signOut}
            </button>
          </div>
        </aside>
        <main className="flex-1 p-5 md:p-8">
          {my.venue.status === "draft" && (
            <p className="mb-6 rounded-xl border border-copper/40 bg-copper/10 px-4 py-3 text-sm text-copper-hi">
              {t.venues.venueDraftNotice}
            </p>
          )}
          {children}
        </main>
      </div>
    </VenueContext.Provider>
  );
}
