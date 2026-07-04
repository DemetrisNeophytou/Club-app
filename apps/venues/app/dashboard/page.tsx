"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Event } from "@portal/shared";
import { useI18n } from "../../lib/i18n";
import { fetchVenueEvents } from "../../lib/data";
import { useVenue } from "../../lib/venue-context";

const STATUS_TONE: Record<string, string> = {
  draft: "text-dim border-line",
  published: "text-seaglass border-seaglass/40",
  soldout: "text-copper-hi border-copper/40",
  cancelled: "text-dim border-line line-through",
  past: "text-dim border-line",
};

export default function EventsListPage() {
  const { venue } = useVenue();
  const { lang, t } = useI18n();
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    fetchVenueEvents(venue.id).then(setEvents).catch(() => setEvents([]));
  }, [venue.id]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-black">{t.venues.events}</h1>
        <Link
          href="/dashboard/events/new"
          className="rounded-xl bg-copper px-4 py-2 font-display text-sm font-bold text-abyss hover:opacity-90"
        >
          {t.venues.newEvent}
        </Link>
      </div>

      {events === null ? (
        <p className="text-dim">{t.common.loading}</p>
      ) : events.length === 0 ? (
        <p className="rounded-2xl border border-line bg-deep p-8 text-center text-dim">
          {t.venues.noEvents}
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/dashboard/events/${e.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 hover:border-copper/50"
              >
                <div>
                  <p className="font-display font-bold">{e.name}</p>
                  <p className="mt-0.5 text-sm text-dim">
                    {new Date(e.starts_at).toLocaleString(lang === "el" ? "el-GR" : "en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 font-mono text-xs ${STATUS_TONE[e.status] ?? "text-dim border-line"}`}
                >
                  {e.status === "draft"
                    ? t.venues.draft
                    : e.status === "published"
                      ? t.venues.published
                      : e.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
