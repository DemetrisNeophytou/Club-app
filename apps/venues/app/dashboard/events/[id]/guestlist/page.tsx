"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "../../../../../lib/i18n";
import { supabase } from "../../../../../lib/supabase";

interface GuestRow {
  id: string;
  status: string;
  scanned_at: string | null;
  holder_name: string | null;
  product_name: string;
  product_type: string;
}

// Guestlist manager (spec §6.4): names, check-in status, CSV export.
export default function GuestlistPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [rows, setRows] = useState<GuestRow[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, status, scanned_at, user_id, product:products(name, type)")
      .eq("event_id", id)
      .in("status", ["active", "scanned"]);

    const userIds = [...new Set((tickets ?? []).map((tk) => tk.user_id as string).filter(Boolean))];
    const names = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", userIds);
      for (const p of profiles ?? []) names.set(p.id as string, (p.name as string | null) ?? null);
    }

    setRows(
      (tickets ?? []).map((tk) => {
        const product = tk.product as unknown as { name: string; type: string };
        return {
          id: tk.id as string,
          status: tk.status as string,
          scanned_at: tk.scanned_at as string | null,
          holder_name: names.get(tk.user_id as string) ?? null,
          product_name: product.name,
          product_type: product.type,
        };
      }),
    );
  }, [id]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows ?? [];
    return q ? list.filter((r) => r.holder_name?.toLowerCase().includes(q)) : list;
  }, [rows, query]);

  const checkedIn = (rows ?? []).filter((r) => r.status === "scanned").length;

  const exportCsv = () => {
    const header = "name,product,type,status,checked_in_at";
    const lines = (rows ?? []).map((r) =>
      [
        `"${(r.holder_name ?? "").replace(/"/g, '""')}"`,
        `"${r.product_name.replace(/"/g, '""')}"`,
        r.product_type,
        r.status === "scanned" ? "checked_in" : "not_arrived",
        r.scanned_at ?? "",
      ].join(","),
    );
    const blob = new Blob(["﻿" + [header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guestlist-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href={`/dashboard/events/${id}`} className="text-sm text-dim hover:text-bone">
            ← {t.venues.editEvent}
          </Link>
          <h1 className="mt-1 font-display text-2xl font-black">{t.venues.guestlistManager}</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg">
            <span className="text-seaglass">{checkedIn}</span>
            <span className="text-dim"> / {(rows ?? []).length}</span>
          </p>
          <button
            onClick={exportCsv}
            className="mt-1 rounded-xl border border-line px-3 py-1.5 text-xs text-dim hover:border-copper hover:text-copper-hi"
          >
            {t.venues.exportCsv}
          </button>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.door.searchName}
        className="mb-4 w-full rounded-xl border border-line bg-card px-4 py-2.5 text-bone outline-none focus:border-copper"
      />

      {rows === null ? (
        <p className="text-dim">{t.common.loading}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-line bg-deep p-8 text-center text-dim">
          {t.common.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium">{r.holder_name ?? "—"}</p>
                <p className="font-mono text-xs text-dim">{r.product_name}</p>
              </div>
              {r.status === "scanned" ? (
                <span className="rounded-full border border-seaglass/40 bg-seaglass/10 px-3 py-1 font-mono text-xs text-seaglass">
                  {t.venues.checkedIn}
                  {r.scanned_at &&
                    ` · ${new Date(r.scanned_at).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              ) : (
                <span className="rounded-full border border-line px-3 py-1 font-mono text-xs text-dim">
                  {t.venues.notArrived}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
