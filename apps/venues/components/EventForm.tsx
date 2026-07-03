"use client";

import { useState } from "react";
import type { Event, LineupSlot } from "@portal/shared";
import { useI18n } from "../lib/i18n";
import { fromLocalInput, toLocalInput } from "../lib/data";

export interface EventFormValues {
  name: string;
  description_el: string | null;
  description_en: string | null;
  starts_at: string;
  doors_at: string;
  ends_at: string | null;
  genre: string[];
  age_limit: number | null;
  lineup: LineupSlot[];
}

const inputCls =
  "w-full rounded-xl border border-line bg-card px-4 py-2.5 text-bone outline-none focus:border-copper";
const labelCls = "mb-1.5 block text-sm text-dim";

export function EventForm({
  initial,
  busy,
  onSubmit,
}: {
  initial?: Event;
  busy: boolean;
  onSubmit: (values: EventFormValues) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [descEl, setDescEl] = useState(initial?.description_el ?? "");
  const [descEn, setDescEn] = useState(initial?.description_en ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at ?? null));
  const [doorsAt, setDoorsAt] = useState(toLocalInput(initial?.doors_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.ends_at ?? null));
  const [genres, setGenres] = useState((initial?.genre ?? []).join(", "));
  const [ageLimit, setAgeLimit] = useState(initial?.age_limit?.toString() ?? "");
  const [lineup, setLineup] = useState<LineupSlot[]>(initial?.lineup ?? []);

  const updateSlot = (i: number, patch: Partial<LineupSlot>) =>
    setLineup(lineup.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: name.trim(),
          description_el: descEl.trim() || null,
          description_en: descEn.trim() || null,
          starts_at: fromLocalInput(startsAt)!,
          doors_at: fromLocalInput(doorsAt)!,
          ends_at: fromLocalInput(endsAt),
          genre: genres
            .split(",")
            .map((g) => g.trim().toLowerCase())
            .filter(Boolean),
          age_limit: ageLimit ? Number(ageLimit) : null,
          lineup: lineup.filter((s) => s.name.trim()),
        });
      }}
    >
      <div>
        <label className={labelCls}>{t.venues.eventName}</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls}>{t.venues.doorsAt}</label>
          <input type="datetime-local" className={inputCls} value={doorsAt} onChange={(e) => setDoorsAt(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t.venues.startsAt}</label>
          <input type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t.venues.endsAt}</label>
          <input type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls}>{t.venues.genres}</label>
          <input className={inputCls} value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="techno, house" />
        </div>
        <div>
          <label className={labelCls}>{t.venues.ageLimit}</label>
          <input type="number" min={16} max={30} className={inputCls} value={ageLimit} onChange={(e) => setAgeLimit(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t.venues.nameEl}</label>
        <textarea className={inputCls} rows={2} value={descEl} onChange={(e) => setDescEl(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>{t.venues.nameEn}</label>
        <textarea className={inputCls} rows={2} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
      </div>

      <div>
        <label className={labelCls}>{t.venues.lineup}</label>
        {lineup.map((slot, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_5rem_2rem] items-center gap-2">
            <input className={inputCls} placeholder={t.venues.artistName} value={slot.name} onChange={(e) => updateSlot(i, { name: e.target.value })} />
            <input className={inputCls} placeholder={t.venues.artistRole} value={slot.role} onChange={(e) => updateSlot(i, { role: e.target.value })} />
            <input className={inputCls} placeholder="23:00" value={slot.time} onChange={(e) => updateSlot(i, { time: e.target.value })} />
            <button type="button" className="text-dim hover:text-copper-hi" onClick={() => setLineup(lineup.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLineup([...lineup, { name: "", role: "", time: "" }])}
          className="rounded-xl border border-line px-3 py-1.5 text-sm text-dim hover:border-copper hover:text-copper-hi"
        >
          {t.venues.addSlot}
        </button>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-copper px-6 py-3 font-display font-bold text-abyss hover:opacity-90 disabled:opacity-50"
      >
        {t.venues.save}
      </button>
    </form>
  );
}
