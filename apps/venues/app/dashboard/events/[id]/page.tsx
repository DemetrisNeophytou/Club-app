"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatPrice, type Event, type Order, type Product } from "@portal/shared";
import { EventForm, type EventFormValues } from "../../../../components/EventForm";
import { ProductForm, type ProductFormValues } from "../../../../components/ProductForm";
import { useI18n } from "../../../../lib/i18n";
import { fetchEvent, fetchEventProducts, fetchPaidOrders } from "../../../../lib/data";
import { supabase } from "../../../../lib/supabase";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [event, setEvent] = useState<Event | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [e, p, o] = await Promise.all([
        fetchEvent(id),
        fetchEventProducts(id),
        fetchPaidOrders(id),
      ]);
      setEvent(e);
      setProducts(p);
      setOrders(o);
    } catch {
      /* keep last state; polling retries */
    }
  }, [id]);

  // Live sales (spec §6.3): Realtime pushes + 30s polling as a safety net.
  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`sales-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `event_id=eq.${id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `event_id=eq.${id}` },
        refresh,
      )
      .subscribe();
    const poll = setInterval(refresh, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [id, refresh]);

  if (!event) return <p className="text-dim">{t.common.loading}</p>;

  const saveEvent = async (values: EventFormValues) => {
    setBusy(true);
    const { error } = await supabase.from("events").update(values).eq("id", event.id);
    setBusy(false);
    setNotice(error ? t.common.error : "✓");
    if (!error) refresh();
  };

  const togglePublish = async () => {
    const next = event.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("events").update({ status: next }).eq("id", event.id);
    if (!error) refresh();
  };

  const saveProduct = async (values: ProductFormValues) => {
    setBusy(true);
    const result =
      editingProduct === "new"
        ? await supabase.from("products").insert({ ...values, event_id: event.id })
        : await supabase.from("products").update(values).eq("id", (editingProduct as Product).id);
    setBusy(false);
    if (!result.error) {
      setEditingProduct(null);
      refresh();
    } else {
      setNotice(t.common.error);
    }
  };

  const deleteProduct = async (p: Product) => {
    if (p.sold_count > 0) {
      setNotice(t.venues.cannotDeleteSold);
      return;
    }
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (!error) refresh();
  };

  const revenueFor = (p: Product) =>
    orders.filter((o) => o.product_id === p.id).reduce((sum, o) => sum + o.amount_cents, 0);
  const feesFor = (p: Product) =>
    orders.filter((o) => o.product_id === p.id).reduce((sum, o) => sum + o.fee_cents, 0);
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount_cents, 0);
  const totalFees = orders.reduce((sum, o) => sum + o.fee_cents, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black">{event.name}</h1>
        <button
          onClick={togglePublish}
          className={`rounded-xl px-4 py-2 font-display text-sm font-bold ${
            event.status === "published"
              ? "border border-line text-dim hover:text-bone"
              : "bg-seaglass text-abyss hover:opacity-90"
          }`}
        >
          {event.status === "published" ? t.venues.unpublish : t.venues.publish}
        </button>
      </div>
      {notice && <p className="text-sm text-copper-hi">{notice}</p>}

      {/* Live sales */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t.venues.liveSales}</h2>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <tbody>
              {products.map((p) => {
                const pct = p.quota ? Math.min((p.sold_count / p.quota) * 100, 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-line last:border-b-0">
                    <td className="w-1/3 px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-card">
                        <div className="h-full rounded-full bg-copper" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-dim">
                      {p.sold_count}
                      {p.quota != null && ` / ${p.quota}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-copper-hi">
                      {formatPrice(revenueFor(p))}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-deep">
                <td className="px-4 py-3 font-bold" colSpan={2}>
                  {t.venues.grossRevenue}
                  <span className="ml-3 text-xs font-normal text-dim">
                    ({t.venues.bookingFees}: {formatPrice(totalFees)})
                  </span>
                </td>
                <td />
                <td className="px-4 py-3 text-right font-mono text-lg text-copper-hi">
                  {formatPrice(totalRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Products */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t.venues.products}</h2>
          {editingProduct === null && (
            <button
              onClick={() => setEditingProduct("new")}
              className="rounded-xl border border-copper px-3 py-1.5 text-sm text-copper-hi hover:bg-copper/10"
            >
              {t.venues.addProduct}
            </button>
          )}
        </div>

        {editingProduct !== null ? (
          <ProductForm
            initial={editingProduct === "new" ? undefined : editingProduct}
            busy={busy}
            onSubmit={saveProduct}
            onCancel={() => setEditingProduct(null)}
          />
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-line bg-deep p-6 text-center text-dim">
            {t.venues.noProducts}
          </p>
        ) : (
          <ul className="space-y-2">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3"
              >
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="font-mono text-xs text-dim">
                    {p.type} ·{" "}
                    {p.type === "table" && p.table_min_spend_cents != null
                      ? `min ${formatPrice(p.table_min_spend_cents)}`
                      : p.price_cents === 0
                        ? t.common.free
                        : formatPrice(p.price_cents)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditingProduct(p)} className="text-sm text-dim hover:text-bone">
                    ✎
                  </button>
                  <button onClick={() => deleteProduct(p)} className="text-sm text-dim hover:text-copper-hi">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Event details */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t.venues.editEvent}</h2>
        <EventForm initial={event} busy={busy} onSubmit={saveEvent} />
      </section>
    </div>
  );
}
