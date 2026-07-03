"use client";

import { useState } from "react";
import type { Product, ProductType } from "@portal/shared";
import { useI18n } from "../lib/i18n";
import { fromLocalInput, toLocalInput } from "../lib/data";

const BOOKING_FEE_CENTS = 100; // €1.00 per ticket (spec §1), included in price

export interface ProductFormValues {
  type: ProductType;
  name: string;
  price_cents: number;
  fee_cents: number;
  quota: number | null;
  per_order_limit: number | null;
  sales_start: string | null;
  sales_end: string | null;
  gl_cutoff_time: string | null;
  table_min_spend_cents: number | null;
  table_capacity: number | null;
  deposit_pct: number | null;
}

const inputCls =
  "w-full rounded-xl border border-line bg-card px-4 py-2.5 text-bone outline-none focus:border-copper";
const labelCls = "mb-1.5 block text-sm text-dim";

export function ProductForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: Product;
  busy: boolean;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<ProductType>(initial?.type ?? "ticket");
  const [name, setName] = useState(initial?.name ?? "");
  const [priceEur, setPriceEur] = useState(initial ? (initial.price_cents / 100).toString() : "");
  const [quota, setQuota] = useState(initial?.quota?.toString() ?? "");
  const [perOrder, setPerOrder] = useState(initial?.per_order_limit?.toString() ?? "4");
  const [salesStart, setSalesStart] = useState(toLocalInput(initial?.sales_start ?? null));
  const [salesEnd, setSalesEnd] = useState(toLocalInput(initial?.sales_end ?? null));
  const [glCutoff, setGlCutoff] = useState(toLocalInput(initial?.gl_cutoff_time ?? null));
  const [minSpendEur, setMinSpendEur] = useState(
    initial?.table_min_spend_cents != null ? (initial.table_min_spend_cents / 100).toString() : "",
  );
  const [capacity, setCapacity] = useState(initial?.table_capacity?.toString() ?? "6");
  const [depositPct, setDepositPct] = useState(initial?.deposit_pct?.toString() ?? "30");

  return (
    <form
      className="space-y-4 rounded-2xl border border-line bg-deep p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const isTicket = type === "ticket";
        const isTable = type === "table";
        onSubmit({
          type,
          name: name.trim(),
          price_cents: isTicket ? Math.round(Number(priceEur) * 100) : 0,
          fee_cents: isTicket ? BOOKING_FEE_CENTS : 0,
          quota: quota ? Number(quota) : null,
          per_order_limit: perOrder ? Number(perOrder) : null,
          sales_start: fromLocalInput(salesStart),
          sales_end: fromLocalInput(salesEnd),
          gl_cutoff_time: type === "guestlist" ? fromLocalInput(glCutoff) : null,
          table_min_spend_cents: isTable ? Math.round(Number(minSpendEur) * 100) : null,
          table_capacity: isTable ? Number(capacity) : null,
          deposit_pct: isTable ? Number(depositPct) : null,
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls}>{t.venues.productType}</label>
          <select
            className={inputCls}
            value={type}
            disabled={Boolean(initial)}
            onChange={(e) => setType(e.target.value as ProductType)}
          >
            <option value="ticket">{t.venues.ticket}</option>
            <option value="guestlist">{t.venues.guestlistProduct}</option>
            <option value="table">{t.venues.tableProduct}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.venues.eventName === "Όνομα event" ? "Όνομα" : "Name"}</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>

      {type === "ticket" && (
        <div>
          <label className={labelCls}>{t.venues.priceIncl}</label>
          <input
            type="number"
            min={1}
            step="0.5"
            className={inputCls}
            value={priceEur}
            onChange={(e) => setPriceEur(e.target.value)}
            required
          />
        </div>
      )}

      {type === "guestlist" && (
        <div>
          <label className={labelCls}>{t.venues.glCutoff}</label>
          <input type="datetime-local" className={inputCls} value={glCutoff} onChange={(e) => setGlCutoff(e.target.value)} required />
        </div>
      )}

      {type === "table" && (
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>{t.venues.minSpend}</label>
            <input type="number" min={50} className={inputCls} value={minSpendEur} onChange={(e) => setMinSpendEur(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>{t.venues.tableCapacity}</label>
            <input type="number" min={2} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>{t.venues.depositPct}</label>
            <input type="number" min={0} max={100} className={inputCls} value={depositPct} onChange={(e) => setDepositPct(e.target.value)} required />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls}>{t.venues.quota}</label>
          <input type="number" min={1} className={inputCls} value={quota} onChange={(e) => setQuota(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>{t.venues.perOrderLimit}</label>
          <input type="number" min={1} max={10} className={inputCls} value={perOrder} onChange={(e) => setPerOrder(e.target.value)} />
        </div>
      </div>

      {type !== "guestlist" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>{t.venues.salesStart}</label>
            <input type="datetime-local" className={inputCls} value={salesStart} onChange={(e) => setSalesStart(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t.venues.salesEnd}</label>
            <input type="datetime-local" className={inputCls} value={salesEnd} onChange={(e) => setSalesEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-copper px-5 py-2.5 font-display text-sm font-bold text-abyss hover:opacity-90 disabled:opacity-50"
        >
          {t.venues.save}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-5 py-2.5 text-sm text-dim hover:text-bone">
          {t.venues.cancel}
        </button>
      </div>
    </form>
  );
}
