import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pushToUser } from "./push.ts";

export const OFFER_WINDOW_MINUTES = 30; // hard rule 2

/**
 * The waitlist reconciler. For one product it:
 *   1. expires offers whose 30-minute window passed,
 *   2. pairs each free returned ticket with the next person in line
 *      (FIFO by position) and sends them a push.
 *
 * Idempotent and safe to call from anywhere: return-ticket calls it
 * immediately, process-waitlist sweeps every few minutes for expiries.
 * A returned ticket keeps its quota slot, so the tickets-left counter
 * never lies (spec §9): the seat transfers, it is never double-sold.
 */
export async function pairWaitlist(db: SupabaseClient, productId: string): Promise<number> {
  // 1. Expire stale offers → their reserved tickets become free again.
  await db
    .from("waitlist")
    .update({ status: "expired" })
    .eq("product_id", productId)
    .eq("status", "offered")
    .lt("offer_expires_at", new Date().toISOString());

  // 2. Free returned tickets = returned, and not reserved by a live offer
  //    or an in-flight purchase.
  const { data: reserved } = await db
    .from("waitlist")
    .select("offered_ticket_id")
    .eq("product_id", productId)
    .in("status", ["offered", "purchased"])
    .not("offered_ticket_id", "is", null);
  const reservedIds = new Set((reserved ?? []).map((r) => r.offered_ticket_id as string));

  const { data: returned } = await db
    .from("tickets")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "returned");
  const freeTickets = (returned ?? []).filter((t) => !reservedIds.has(t.id as string));
  if (freeTickets.length === 0) return 0;

  const { data: waiting } = await db
    .from("waitlist")
    .select("id, user_id")
    .eq("product_id", productId)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(freeTickets.length);
  if (!waiting || waiting.length === 0) return 0;

  const { data: product } = await db
    .from("products")
    .select("name, event:events(name)")
    .eq("id", productId)
    .single();
  const eventName = (product?.event as unknown as { name: string } | null)?.name ?? "PORTAL";

  let offered = 0;
  for (let i = 0; i < waiting.length; i++) {
    const entry = waiting[i]!;
    const ticket = freeTickets[i]!;
    const expires = new Date(Date.now() + OFFER_WINDOW_MINUTES * 60_000).toISOString();

    // Guard on status=waiting: concurrent reconcilers can't double-offer.
    const { data: updated } = await db
      .from("waitlist")
      .update({
        status: "offered",
        offered_at: new Date().toISOString(),
        offer_expires_at: expires,
        offered_ticket_id: ticket.id,
      })
      .eq("id", entry.id)
      .eq("status", "waiting")
      .select("id");
    if (!updated || updated.length === 0) continue;

    offered++;
    await pushToUser(
      db,
      entry.user_id as string,
      eventName,
      "Σειρά σου! Έχεις 30 λεπτά για να αγοράσεις το εισιτήριό σου. / You're up! 30 minutes to grab your ticket.",
      { type: "waitlist_offer", waitlist_id: entry.id as string },
    );
  }
  return offered;
}
