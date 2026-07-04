"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EventForm, type EventFormValues } from "../../../../components/EventForm";
import { useI18n } from "../../../../lib/i18n";
import { slugify } from "../../../../lib/data";
import { supabase } from "../../../../lib/supabase";
import { useVenue } from "../../../../lib/venue-context";

export default function NewEventPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const create = async (values: EventFormValues) => {
    setBusy(true);
    setError(false);
    const { data, error: insertError } = await supabase
      .from("events")
      .insert({ ...values, venue_id: venue.id, slug: slugify(values.name), status: "draft" })
      .select()
      .single();
    if (insertError || !data) {
      setError(true);
      setBusy(false);
      return;
    }
    router.replace(`/dashboard/events/${data.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-display text-2xl font-black">{t.venues.newEvent}</h1>
      <EventForm busy={busy} onSubmit={create} />
      {error && <p className="mt-3 text-sm text-copper-hi">{t.common.error}</p>}
    </div>
  );
}
