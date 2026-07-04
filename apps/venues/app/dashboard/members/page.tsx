"use client";

import { useCallback, useEffect, useState } from "react";
import type { VenueRole } from "@portal/shared";
import { useI18n } from "../../../lib/i18n";
import { supabase } from "../../../lib/supabase";
import { useVenue } from "../../../lib/venue-context";

interface MemberRow {
  user_id: string;
  role: VenueRole;
  name: string | null;
}

// Team management (spec §6.1): add members with roles, remove them.
export default function MembersPage() {
  const { venue, role: myRole } = useVenue();
  const { t } = useI18n();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VenueRole>("door");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const roleLabel: Record<VenueRole, string> = {
    owner: t.venues.roleOwner,
    manager: t.venues.roleManager,
    promoter: t.venues.rolePromoter,
    door: t.venues.roleDoor,
  };

  const load = useCallback(async () => {
    const { data: rows } = await supabase
      .from("venue_members")
      .select("user_id, role")
      .eq("venue_id", venue.id);
    const ids = (rows ?? []).map((r) => r.user_id as string);
    const names = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", ids);
      for (const p of profiles ?? []) names.set(p.id as string, (p.name as string | null) ?? null);
    }
    setMembers(
      (rows ?? []).map((r) => ({
        user_id: r.user_id as string,
        role: r.role as VenueRole,
        name: names.get(r.user_id as string) ?? null,
      })),
    );
  }, [venue.id]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke("add-venue-member", {
      body: { venue_id: venue.id, email: email.trim(), role },
    });
    setBusy(false);
    if (error || !data?.ok) {
      setMessage(t.common.error);
      return;
    }
    setEmail("");
    load();
  };

  const remove = async (userId: string) => {
    await supabase.from("venue_members").delete().eq("venue_id", venue.id).eq("user_id", userId);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-black">{t.venues.members}</h1>

      {myRole === "owner" && (
        <form
          className="mb-6 space-y-3 rounded-2xl border border-line bg-deep p-5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="block text-sm text-dim">{t.venues.memberEmail}</label>
          <div className="flex flex-wrap gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-bone outline-none focus:border-copper"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as VenueRole)}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-bone outline-none focus:border-copper"
            >
              {(Object.keys(roleLabel) as VenueRole[]).map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-copper px-4 py-2.5 font-display text-sm font-bold text-abyss hover:opacity-90 disabled:opacity-50"
            >
              {t.venues.addMember}
            </button>
          </div>
          {message && <p className="text-sm text-copper-hi">{message}</p>}
        </form>
      )}

      {members === null ? (
        <p className="text-dim">{t.common.loading}</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium">{m.name ?? m.user_id.slice(0, 8)}</p>
                <p className="font-mono text-xs text-copper-hi">{roleLabel[m.role]}</p>
              </div>
              {myRole === "owner" && m.role !== "owner" && (
                <button onClick={() => remove(m.user_id)} className="text-xs text-dim hover:text-copper-hi">
                  {t.venues.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
