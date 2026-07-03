# @portal/db

Supabase schema, RLS policies and demo seed for PORTAL (spec §4, §9, Phase 1 step 1).

## Migrations

| File | Contents |
|---|---|
| `20260703100000_init_schema.sql` | Enums, all 9 tables, indexes, `updated_at` triggers, auto-profile-on-signup |
| `20260703100100_functions.sql` | `claim_product_quota` / `release_product_quota` (row-locked, service-role only), `join_waitlist` (atomic FIFO position), ticket code generator |
| `20260703100200_rls.sql` | RLS enabled on every table + policies; `is_venue_member` / `is_event_venue_member` helpers |

`seed.sql` — 5 cities, 6 demo venues, 6 events (incl. one sold-out for the waitlist flow), 18 products. Dates are relative to `now()` so the Tonight feed always has content. **Awaiting reconciliation with portal-app.html once it's added to the repo.**

## Usage (requires Docker + Supabase CLI)

```bash
pnpm --filter @portal/db db:start   # local stack
pnpm --filter @portal/db db:reset   # apply migrations + seed
pnpm --filter @portal/db db:types   # regenerate TS types into packages/shared
```

⚠️ Migrations have NOT been applied anywhere yet — the schema is pending owner approval per spec §10.

## Security model (spec §9)

- RLS on every table. Public can read: cities, active venues, published/soldout/past events and their products. Users read only their own orders/tickets/waitlist/profile. Venue staff read only their own venue's data (door role included for scanning).
- `orders` and `tickets` have **no client write policies** — all money-touching writes go through Edge Functions using the service role (Phase 1 step 3: `create-payment-intent`, `issue-tickets`, `validate-scan`).
- Quota is never trusted from the client: `claim_product_quota()` takes a `FOR UPDATE` row lock, enforces release windows, per-order limits and quota, then increments `sold_count`. `release_product_quota()` reverses it on payment failure/expiry/return.
- Waitlist joins go through `join_waitlist()` so FIFO positions are assigned atomically (hard rule 2).
