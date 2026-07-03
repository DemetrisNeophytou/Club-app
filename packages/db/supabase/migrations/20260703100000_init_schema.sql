-- PORTAL — Phase 1 step 1: core schema
-- Spec: PORTAL-SPEC.md §4 (data model) + §9 (non-negotiables)

create extension if not exists pgcrypto;

-- ─── Enums ────────────────────────────────────────────────────────────────

create type public.venue_status   as enum ('draft', 'active', 'suspended');
create type public.venue_role     as enum ('owner', 'manager', 'promoter', 'door');
create type public.event_status   as enum ('draft', 'published', 'soldout', 'cancelled', 'past');
create type public.product_type   as enum ('ticket', 'guestlist', 'table');
create type public.order_status   as enum ('pending', 'paid', 'refunded', 'failed');
create type public.ticket_status  as enum ('active', 'scanned', 'returned', 'transferred', 'refunded');
create type public.waitlist_status as enum ('waiting', 'offered', 'purchased', 'expired');
create type public.app_lang       as enum ('el', 'en');

-- ─── Tables ───────────────────────────────────────────────────────────────

create table public.cities (
  id       uuid primary key default gen_random_uuid(),
  name_el  text not null,
  name_en  text not null,
  slug     text not null unique
);

create table public.venues (
  id                 uuid primary key default gen_random_uuid(),
  city_id            uuid not null references public.cities (id),
  name               text not null,
  slug               text not null unique,
  description_el     text,
  description_en     text,
  address            text,
  geo                point,
  cover_image        text,
  logo               text,
  capacity           integer check (capacity > 0),
  stripe_account_id  text,
  status             public.venue_status not null default 'draft',
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.venue_members (
  user_id    uuid not null references auth.users (id) on delete cascade,
  venue_id   uuid not null references public.venues (id) on delete cascade,
  role       public.venue_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  name           text not null,
  slug           text not null unique,
  description_el text,
  description_en text,
  cover_image    text,
  starts_at      timestamptz not null,
  doors_at       timestamptz not null,
  ends_at        timestamptz,
  genre          text[] not null default '{}',
  age_limit      integer,
  status         public.event_status not null default 'draft',
  -- [{ "name": "...", "role": "...", "time": "..." }]
  lineup         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (doors_at <= starts_at)
);

create table public.products (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid not null references public.events (id) on delete cascade,
  type                   public.product_type not null,
  name                   text not null,
  -- Hard rule 1: price_cents ALREADY INCLUDES fee_cents. Displayed = paid.
  price_cents            integer not null default 0 check (price_cents >= 0),
  fee_cents              integer not null default 0 check (fee_cents >= 0),
  currency               char(3) not null default 'EUR' check (currency = 'EUR'),
  quota                  integer check (quota >= 0),
  sold_count             integer not null default 0 check (sold_count >= 0),
  per_order_limit        integer check (per_order_limit > 0),
  sales_start            timestamptz,
  sales_end              timestamptz,
  gl_cutoff_time         timestamptz,   -- guestlist: free entry before this
  table_min_spend_cents  integer check (table_min_spend_cents >= 0),
  table_capacity         integer check (table_capacity > 0),
  deposit_pct            integer check (deposit_pct between 0 and 100),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (fee_cents <= price_cents),
  -- Hard rule 4: guestlist is free
  check (type <> 'guestlist' or price_cents = 0),
  check (type <> 'table' or (table_min_spend_cents is not null and deposit_pct is not null)),
  check (quota is null or sold_count <= quota)
);

create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id),
  event_id                  uuid not null references public.events (id),
  product_id                uuid not null references public.products (id),
  qty                       integer not null check (qty > 0),
  amount_cents              integer not null check (amount_cents >= 0),
  fee_cents                 integer not null check (fee_cents >= 0),
  status                    public.order_status not null default 'pending',
  stripe_payment_intent_id  text unique,
  created_at                timestamptz not null default now()
);

create table public.tickets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id),
  event_id        uuid not null references public.events (id),
  product_id      uuid not null references public.products (id),
  user_id         uuid not null references auth.users (id),
  code            text not null unique,
  qr_secret       text not null default encode(gen_random_bytes(20), 'hex'),
  status          public.ticket_status not null default 'active',
  scanned_at      timestamptz,
  scanned_by      uuid references auth.users (id),
  transferred_to  uuid references auth.users (id),
  created_at      timestamptz not null default now()
);

create table public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  product_id        uuid not null references public.products (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  position          integer not null check (position > 0),
  status            public.waitlist_status not null default 'waiting',
  offered_at        timestamptz,
  offer_expires_at  timestamptz,
  created_at        timestamptz not null default now(),
  unique (product_id, user_id)
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  phone      text,
  dob        date,
  lang       public.app_lang not null default 'el',
  city_id    uuid references public.cities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────

create index venues_city_idx          on public.venues (city_id) where status = 'active';
create index venue_members_venue_idx  on public.venue_members (venue_id);
create index events_venue_idx         on public.events (venue_id, starts_at);
create index events_feed_idx          on public.events (status, starts_at);
create index products_event_idx       on public.products (event_id);
create index orders_user_idx          on public.orders (user_id, created_at desc);
create index orders_event_idx         on public.orders (event_id);
create index tickets_user_idx         on public.tickets (user_id);
create index tickets_event_idx        on public.tickets (event_id);
create index tickets_order_idx        on public.tickets (order_id);
create index waitlist_fifo_idx        on public.waitlist (product_id, position);
create index waitlist_user_idx        on public.waitlist (user_id);

-- ─── updated_at bookkeeping ───────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger venues_updated_at   before update on public.venues   for each row execute function public.set_updated_at();
create trigger events_updated_at   before update on public.events   for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- ─── Auto-create profile on signup ────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, lang)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'lang', '')::public.app_lang, 'el')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
