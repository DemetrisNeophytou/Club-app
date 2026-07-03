# PORTAL — Product Specification v1.0
### Nightlife ticketing & booking platform for Cyprus
**Owner:** Demetris · **Date:** July 2026 · **Status:** LOCKED — this document is the project constitution. Claude Code must follow it. Any deviation requires explicit approval from the owner.

---

## 1. What we are building

PORTAL is Cyprus's first nightlife platform: users discover club nights, bar events and parties, and book **tickets, guestlist spots, and VIP tables** — all in-app, with QR entry at the door. Venues get a B2B dashboard to create events, sell online, manage guestlists and scan people in.

**Model reference (copy these, adapted to Cyprus):**
- **DICE** → mobile-only QR tickets, price transparency (price shown = price paid), no scalping: unwanted tickets are returned in-app and resold via waitlist at face value.
- **Xceed** → two-sided platform: consumer app + "Nightgraph"-style B2B cloud dashboard for venues (sales, guestlists, analytics, door scanning).
- **Discotech/Tablelist** → three products per event: ticket / free-or-discounted guestlist / VIP table with min spend.

**Cyprus-only. Cities:** Λεμεσός, Λευκωσία, Αγία Νάπα/Πρωταράς, Λάρνακα, Πάφος.
**Languages:** Greek (primary) + English (tourists — critical for Ayia Napa summer traffic).

**Revenue:**
- Commission 10% on ticket face value + €1.00 booking fee per ticket (fee shown transparently, included in displayed price).
- VIP tables: 10% of min spend, charged on the 30% deposit taken in-app.
- Guestlist: free for users; venues pay per confirmed check-in (€0.50) OR it's bundled in their SaaS plan (Phase 2 decision).

---

## 2. The three apps

| App | Users | Platform |
|---|---|---|
| **Portal** (consumer) | Clubbers, tourists | React Native (Expo), iOS + Android |
| **Portal Venues** (B2B dashboard) | Club owners, promoters | Next.js web app, responsive |
| **Portal Door** (scanner) | Door staff | Same Expo project, separate role/mode — camera QR scanner, works offline |

MVP builds all three, but thin. See §8 phases.

---

## 3. Tech stack (locked)

- **Frontend consumer + door:** Expo (React Native), TypeScript, Expo Router, NativeWind for styling.
- **B2B dashboard:** Next.js 14+ (App Router), TypeScript, Tailwind.
- **Backend:** Supabase — Postgres, Auth, Row Level Security, Realtime, Edge Functions, Storage.
- **Payments:** Stripe — Payment Intents + **Stripe Connect (Express accounts)** so venues get paid directly, platform takes application fee automatically. Apple Pay / Google Pay enabled.
- **QR:** signed tokens (JWT with event_id + ticket_id + rotating nonce), rendered client-side; validated by Door app against Supabase Edge Function. Offline mode: Door app pre-downloads the event's ticket manifest and validates signatures locally, syncs scans when back online.
- **Push:** Expo Notifications.
- **Analytics:** PostHog (self-serve tier).

Do NOT introduce other services without approval. Solo founder — minimize moving parts.

---

## 4. Data model (Postgres / Supabase)

```
cities        id, name_el, name_en, slug
venues        id, city_id, name, slug, description_el/en, address, geo,
              cover_image, logo, capacity, stripe_account_id,
              status(draft|active|suspended), created_by
venue_members user_id, venue_id, role(owner|manager|promoter|door)
events        id, venue_id, name, slug, description_el/en, cover_image,
              starts_at, doors_at, ends_at, genre[], age_limit,
              status(draft|published|soldout|cancelled|past),
              lineup jsonb [{name, role, time}]
products      id, event_id, type(ticket|guestlist|table),
              name, price_cents, fee_cents, currency('EUR'),
              quota, sold_count, per_order_limit,
              sales_start, sales_end,           -- releases: early bird etc.
              gl_cutoff_time,                   -- guestlist: free before X
              table_min_spend_cents, table_capacity, deposit_pct
orders        id, user_id, event_id, product_id, qty,
              amount_cents, fee_cents, status(pending|paid|refunded|failed),
              stripe_payment_intent_id, created_at
tickets       id, order_id, event_id, product_id, user_id,
              code (unique), qr_secret,
              status(active|scanned|returned|transferred|refunded),
              scanned_at, scanned_by, transferred_to
waitlist      id, event_id, product_id, user_id, position,
              status(waiting|offered|purchased|expired),
              offered_at, offer_expires_at
users         (Supabase auth) + profile: name, phone, dob, lang, city_id
```

**Hard business rules:**
1. Price displayed = price paid. `price_cents` already includes `fee_cents`. No surprises at checkout.
2. A returned ticket goes to `waitlist` FIFO: first person gets a push + 30-min purchase window at **face value**. No secondary market, no transfers outside the app except the in-app "transfer to friend" (free, changes `user_id`).
3. Ticket QR activates 2h before `doors_at` (anti-screenshot: QR payload rotates every 60s via TOTP-style nonce).
4. Guestlist = free product, requires check-in before `gl_cutoff_time`; after cutoff the QR shows "expired" state.
5. Tables: charge 30% deposit via Stripe now, rest at venue. Cancellation >48h = full refund; <48h = deposit kept (configurable per venue).
6. Refunds only via ticket return → waitlist resale, or event cancellation (auto full refund to all).
7. All money flows through Stripe Connect: destination charge to venue's account, `application_fee_amount` = commission + booking fee.

---

## 5. Consumer app — screens & flows

Design reference: **portal-app.html** (included alongside this spec — replicate its look 1:1).

**Design system (locked):**
- Palette: abyss `#080C16`, deep `#0E1524`, card `#141D31`, line `#233049`, copper `#D98A52`, copper-hi `#F2A868`, seaglass `#5AC8BE`, bone `#F1ECE1`, dim `#8A94AB`.
- Type: Archivo (variable — wide/black for display, regular for UI), Space Mono for prices/times/codes.
- Signature: the **portal arch** — event hero images clipped in an arch shape; QR framed by an animated conic-gradient "portal ring".
- Dark only. Copper on midnight blue. Never neon green.

**Tabs:** Απόψε (Tonight) · Αναζήτηση (Search) · Εισιτήρια (Tickets) · Προφίλ (Profile)

**Flows:**
1. **Discover:** city selector → date chips (Tonight/Tomorrow/weekend) → genre filter → event cards (arch hero, badges: "Guestlist ανοιχτό", "Φεύγει γρήγορα", "Sold out", tickets-left counter).
2. **Event page:** arch hero, info strip (doors/age/genre/left), lineup, products list (ticket releases w/ strikethrough old price, guestlist w/ cutoff, table w/ min spend), fair-ticketing trust line, about.
3. **Checkout:** bottom sheet → quantity stepper → total + fee note → Apple/Google Pay or card → success toast → ticket in Tickets tab. Two taps max after product selection.
4. **Ticket:** portal ring + QR, live pulse "Ενεργό", event meta, code, actions: Transfer to friend / Return ticket.
5. **Sold out:** join waitlist → position shown → push notification on offer → 30-min window.
6. **Profile:** language (EL/EN), payment methods, past events history, notifications prefs.

---

## 6. Venue dashboard (Portal Venues)

1. **Onboarding:** create venue → Stripe Connect Express onboarding link → add members with roles.
2. **Events:** create/edit event (bilingual fields), add products (releases with schedule, guestlist with cutoff, tables with floor labels), publish.
3. **Live sales:** realtime chart (Supabase Realtime), tickets sold/quota, revenue net of fees, guestlist signups.
4. **Guestlist manager:** list with names, +N guests, check-in status; export CSV.
5. **Payouts:** Stripe handles; dashboard shows upcoming payout + statement per event.
6. **Analytics (Phase 2):** repeat customers, top genres, conversion, comparison vs own past events.

---

## 7. Door app

- Login as venue member with `door` role → select tonight's event → download manifest (offline capable).
- Camera scan → instant result: ✅ green (name, product type, +N) / 🔁 already scanned (time + by whom) / ❌ invalid/expired.
- Manual search by name (for guestlist without phone).
- Live counter: scanned / total inside.

---

## 8. Build phases — Claude Code roadmap

**Phase 1 — Foundation (build first, in this order):**
1. Supabase schema + RLS policies + seed script (the 6 demo venues/events from the prototype).
2. Consumer app: Tonight feed → Event page → checkout with Stripe test mode → Tickets tab + QR screen. EL/EN i18n from day one.
3. Edge Functions: create-payment-intent, issue-tickets (webhook on payment success), validate-scan.

**Phase 2 — Two-sided:**
4. Venues dashboard: auth, event CRUD, product CRUD, publish, live sales view.
5. Door scanner mode + offline manifest.
6. Waitlist + return-ticket flow + push notifications.

**Phase 3 — Growth:**
7. Table booking with deposit flow.
8. Analytics, promoted listings, promoter referral links (each promoter gets a tracked link, commission split).

**Definition of done per feature:** typed, RLS-tested (a venue can never read another venue's data; a user only their own tickets), works on iOS + Android, EL + EN strings complete.

---

## 9. Non-negotiables

- **Security:** RLS on every table. QR validation server-side (or signed offline manifest). Never trust the client for `sold_count`/quota — decrement via Postgres function with row lock.
- **GDPR:** EU users. Data minimization, delete-account flow, cookie-less analytics config on web.
- **No dark patterns:** no hidden fees, no fake scarcity (tickets-left counter must be real), no spam push.
- **Performance:** feed loads < 1s on 4G; images via Supabase Storage with transforms.
- **Tone of copy:** Greek first, short, confident, zero corporate filler. English mirrors it.

---

## 10. Prompt to start Claude Code

Paste this as the first message in Claude Code, inside the empty project folder containing this file and portal-app.html:

> Read PORTAL-SPEC.md fully — it is the project constitution. Set up a monorepo (pnpm workspaces): `apps/mobile` (Expo + TypeScript + NativeWind), `apps/venues` (Next.js 14 + Tailwind), `packages/db` (Supabase schema, migrations, seed), `packages/shared` (types, i18n). Then execute Phase 1 step 1: full Supabase schema with RLS policies and seed data matching the demo events in portal-app.html. Show me the schema for approval before applying migrations.
