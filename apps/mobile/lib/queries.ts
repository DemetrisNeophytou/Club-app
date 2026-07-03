import type { City, Event, Product, Ticket, Venue } from "@portal/shared";
import { supabase } from "./supabase";

export type FeedEvent = Event & {
  venue: Pick<Venue, "id" | "name" | "slug" | "city_id" | "cover_image">;
  products: Product[];
};

export type TicketWithEvent = Ticket & {
  event: Pick<Event, "id" | "name" | "slug" | "starts_at" | "doors_at" | "cover_image">;
  product: Pick<Product, "id" | "type" | "name" | "gl_cutoff_time">;
};

const EVENT_SELECT =
  "*, venue:venues(id, name, slug, city_id, cover_image), products(*)";

export async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase.from("cities").select("*").order("slug");
  if (error) throw error;
  return data as City[];
}

/** Upcoming published/soldout events, soonest first (RLS hides drafts). */
export async function fetchFeed(): Promise<FeedEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .in("status", ["published", "soldout"])
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data as unknown as FeedEvent[];
}

export async function fetchEventBySlug(slug: string): Promise<FeedEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as FeedEvent | null;
}

/** Current user's tickets, newest event first (RLS: only their own). */
export async function fetchMyTickets(): Promise<TicketWithEvent[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "*, event:events(id, name, slug, starts_at, doors_at, cover_image), product:products(id, type, name, gl_cutoff_time)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as TicketWithEvent[];
}

export type WaitlistWithRelations = {
  id: string;
  product_id: string;
  position: number;
  status: string;
  offer_expires_at: string | null;
  product: Pick<Product, "id" | "name" | "price_cents" | "type">;
  event: Pick<Event, "id" | "name" | "starts_at">;
};

/** My live waitlist entries (RLS: own only). */
export async function fetchMyWaitlist(): Promise<WaitlistWithRelations[]> {
  const { data, error } = await supabase
    .from("waitlist")
    .select(
      "id, product_id, position, status, offer_expires_at, product:products(id, name, price_cents, type), event:events(id, name, starts_at)",
    )
    .in("status", ["waiting", "offered"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as WaitlistWithRelations[];
}

export async function fetchTicket(id: string): Promise<TicketWithEvent | null> {
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "*, event:events(id, name, slug, starts_at, doors_at, cover_image), product:products(id, type, name, gl_cutoff_time)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as TicketWithEvent | null;
}
