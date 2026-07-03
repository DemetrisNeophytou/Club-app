# PORTAL

Nightlife ticketing & booking for Cyprus — tickets, guestlist, VIP tables, QR entry.
**Constitution:** [PORTAL-SPEC.md](./PORTAL-SPEC.md). Read it before touching anything.

## Monorepo (pnpm workspaces)

| Package | What | Stack |
|---|---|---|
| `apps/mobile` | Portal (consumer) + Portal Door (scanner mode) | Expo, TypeScript, Expo Router, NativeWind |
| `apps/venues` | Portal Venues — B2B dashboard | Next.js (App Router), TypeScript, Tailwind |
| `packages/db` | Supabase schema, migrations, RLS, seed | SQL, Supabase CLI |
| `packages/shared` | Domain types, i18n (EL/EN), design tokens | TypeScript |

## Getting started

```bash
pnpm install

# database (needs Docker + Supabase CLI)
pnpm db:start          # local Supabase stack
pnpm db:reset          # apply migrations + demo seed

# apps
pnpm mobile            # Expo dev server
pnpm venues            # Next.js dev server
```

Copy `apps/mobile/.env.example` → `.env` and `apps/venues/.env.example` → `.env.local`, filling in the anon key that `supabase start` prints.

## Status

Phase 1, step 1 (spec §8): schema + RLS + seed written, **pending owner approval — no migrations applied yet**. `portal-app.html` (design prototype) is not in the repo yet; the seed's demo venues/events are spec-consistent placeholders to be reconciled 1:1 when it lands.
