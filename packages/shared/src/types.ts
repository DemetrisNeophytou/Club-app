// Domain types mirroring the PORTAL schema (PORTAL-SPEC.md §4).
// Once local Supabase runs, regenerate exact DB types with:
//   pnpm --filter @portal/db db:types  →  src/database.types.ts

export type VenueStatus = "draft" | "active" | "suspended";
export type VenueRole = "owner" | "manager" | "promoter" | "door";
export type EventStatus = "draft" | "published" | "soldout" | "cancelled" | "past";
export type ProductType = "ticket" | "guestlist" | "table";
export type OrderStatus = "pending" | "paid" | "refunded" | "failed";
export type TicketStatus = "active" | "scanned" | "returned" | "transferred" | "refunded";
export type WaitlistStatus = "waiting" | "offered" | "purchased" | "expired";
export type AppLang = "el" | "en";

export interface City {
  id: string;
  name_el: string;
  name_en: string;
  slug: string;
}

export interface Venue {
  id: string;
  city_id: string;
  name: string;
  slug: string;
  description_el: string | null;
  description_en: string | null;
  address: string | null;
  geo: { x: number; y: number } | null;
  cover_image: string | null;
  logo: string | null;
  capacity: number | null;
  stripe_account_id: string | null;
  status: VenueStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VenueMember {
  user_id: string;
  venue_id: string;
  role: VenueRole;
  created_at: string;
}

export interface LineupSlot {
  name: string;
  role: string;
  time: string;
}

export interface Event {
  id: string;
  venue_id: string;
  name: string;
  slug: string;
  description_el: string | null;
  description_en: string | null;
  cover_image: string | null;
  starts_at: string;
  doors_at: string;
  ends_at: string | null;
  genre: string[];
  age_limit: number | null;
  status: EventStatus;
  lineup: LineupSlot[];
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  event_id: string;
  type: ProductType;
  name: string;
  /** Hard rule 1: already includes fee_cents — displayed price = paid price. */
  price_cents: number;
  fee_cents: number;
  currency: "EUR";
  quota: number | null;
  sold_count: number;
  per_order_limit: number | null;
  sales_start: string | null;
  sales_end: string | null;
  gl_cutoff_time: string | null;
  table_min_spend_cents: number | null;
  table_capacity: number | null;
  deposit_pct: number | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  event_id: string;
  product_id: string;
  qty: number;
  amount_cents: number;
  fee_cents: number;
  status: OrderStatus;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  order_id: string;
  event_id: string;
  product_id: string;
  user_id: string;
  code: string;
  qr_secret: string;
  status: TicketStatus;
  scanned_at: string | null;
  scanned_by: string | null;
  transferred_to: string | null;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  event_id: string;
  product_id: string;
  user_id: string;
  position: number;
  status: WaitlistStatus;
  offered_at: string | null;
  offer_expires_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  dob: string | null;
  lang: AppLang;
  city_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Tickets left, honest (spec §9: no fake scarcity). */
export function ticketsLeft(p: Pick<Product, "quota" | "sold_count">): number | null {
  return p.quota === null ? null : Math.max(p.quota - p.sold_count, 0);
}

/** "€15.00" — price shown IS price paid. */
export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}
