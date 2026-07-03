import type { City, Event, Order, Product, Venue, VenueRole } from "@portal/shared";
import { supabase } from "./supabase";

export interface MyVenue {
  venue: Venue;
  role: VenueRole;
}

/** First venue the signed-in user belongs to (thin MVP: one venue). */
export async function fetchMyVenue(): Promise<MyVenue | null> {
  const { data, error } = await supabase
    .from("venue_members")
    .select("role, venue:venues(*)")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { venue: data.venue as unknown as Venue, role: data.role as VenueRole };
}

export async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase.from("cities").select("*").order("slug");
  if (error) throw error;
  return data as City[];
}

export async function fetchVenueEvents(venueId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("venue_id", venueId)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data as Event[];
}

export async function fetchEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

export async function fetchEventProducts(eventId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");
  if (error) throw error;
  return data as Product[];
}

export async function fetchPaidOrders(eventId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "paid");
  if (error) throw error;
  return data as Order[];
}

export function slugify(name: string): string {
  const map: Record<string, string> = {
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
    κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
    ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
    ά: "a", έ: "e", ή: "i", ί: "i", ό: "o", ύ: "y", ώ: "o", ϊ: "i", ϋ: "y",
  };
  const base = name
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : suffix;
}

/** datetime-local input value ↔ ISO string */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
