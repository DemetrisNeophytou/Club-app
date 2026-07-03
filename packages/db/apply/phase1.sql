-- ============================================================
-- PORTAL — Phase 1: schema + functions + RLS + demo seed
-- Επικόλλησέ το ΟΛΟ στο Supabase Dashboard → SQL Editor → Run.
-- Τρέχει μία φορά σε άδειο project. Generated from migrations:
--   20260703100000_init_schema.sql
--   20260703100100_functions.sql
--   20260703100200_rls.sql
--   seed.sql
-- ============================================================

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

-- PORTAL — trusted database functions
-- Spec §9: never trust the client for sold_count/quota — row-locked functions only.

-- ─── Ticket codes ─────────────────────────────────────────────────────────
-- 8 chars, ambiguity-free alphabet (no 0/O/1/I/L). Printed on the ticket screen.

create or replace function public.gen_ticket_code()
returns text
language sql
volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

alter table public.tickets alter column code set default public.gen_ticket_code();

-- ─── Quota claim / release ────────────────────────────────────────────────
-- Called by the create-payment-intent Edge Function (service role) BEFORE
-- creating the Stripe PaymentIntent, and released on failure/expiry.

create or replace function public.claim_product_quota(p_product_id uuid, p_qty integer)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_event   public.events%rowtype;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'INVALID_QTY';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;  -- row lock: serializes concurrent buyers of the same product

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select * into v_event from public.events where id = v_product.event_id;

  if v_event.status <> 'published' then
    raise exception 'EVENT_NOT_ON_SALE';
  end if;
  if v_product.per_order_limit is not null and p_qty > v_product.per_order_limit then
    raise exception 'OVER_PER_ORDER_LIMIT';
  end if;
  if v_product.sales_start is not null and now() < v_product.sales_start then
    raise exception 'SALES_NOT_STARTED';
  end if;
  if v_product.sales_end is not null and now() > v_product.sales_end then
    raise exception 'SALES_ENDED';
  end if;
  if v_product.quota is not null and v_product.sold_count + p_qty > v_product.quota then
    raise exception 'SOLD_OUT';
  end if;

  update public.products
  set sold_count = sold_count + p_qty
  where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

create or replace function public.release_product_quota(p_product_id uuid, p_qty integer)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'INVALID_QTY';
  end if;

  update public.products
  set sold_count = greatest(sold_count - p_qty, 0)
  where id = p_product_id
  returning * into v_product;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  return v_product;
end;
$$;

-- Quota functions are server-side only (Edge Functions with service role).
revoke execute on function public.claim_product_quota(uuid, integer)   from public, anon, authenticated;
revoke execute on function public.release_product_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_product_quota(uuid, integer)   to service_role;
grant execute on function public.release_product_quota(uuid, integer) to service_role;

-- ─── Waitlist (hard rule 2: FIFO, face value) ─────────────────────────────
-- Users join through this function so `position` is assigned atomically.

create or replace function public.join_waitlist(p_product_id uuid)
returns public.waitlist
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_entry   public.waitlist%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Lock the product row so two joiners can't get the same position.
  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  insert into public.waitlist (event_id, product_id, user_id, position)
  values (
    v_product.event_id,
    p_product_id,
    auth.uid(),
    coalesce((select max(position) from public.waitlist where product_id = p_product_id), 0) + 1
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.join_waitlist(uuid) to authenticated;
revoke execute on function public.join_waitlist(uuid) from public, anon;

-- PORTAL — Row Level Security
-- Spec §9: RLS on every table. A venue can never read another venue's data;
-- a user only their own tickets/orders. Money-mutating writes go through
-- Edge Functions (service role bypasses RLS) — so no client write policies
-- exist on orders/tickets/waitlist-status.

-- ─── Helper: membership check (security definer avoids RLS recursion) ─────

create or replace function public.is_venue_member(p_venue_id uuid, p_roles public.venue_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venue_members vm
    where vm.venue_id = p_venue_id
      and vm.user_id = auth.uid()
      and (p_roles is null or vm.role = any (p_roles))
  );
$$;

grant execute on function public.is_venue_member(uuid, public.venue_role[]) to authenticated, anon;

-- Convenience: is the event's parent venue mine?
create or replace function public.is_event_venue_member(p_event_id uuid, p_roles public.venue_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and public.is_venue_member(e.venue_id, p_roles)
  );
$$;

grant execute on function public.is_event_venue_member(uuid, public.venue_role[]) to authenticated, anon;

-- ─── Enable RLS everywhere ────────────────────────────────────────────────

alter table public.cities        enable row level security;
alter table public.venues        enable row level security;
alter table public.venue_members enable row level security;
alter table public.events        enable row level security;
alter table public.products      enable row level security;
alter table public.orders        enable row level security;
alter table public.tickets       enable row level security;
alter table public.waitlist      enable row level security;
alter table public.profiles      enable row level security;

-- ─── cities: public reference data ────────────────────────────────────────

create policy "cities are public"
  on public.cities for select
  using (true);

-- ─── venues ───────────────────────────────────────────────────────────────

create policy "active venues are public"
  on public.venues for select
  using (status = 'active' or public.is_venue_member(id));

create policy "authenticated users can create a venue"
  on public.venues for insert
  to authenticated
  with check (created_by = auth.uid() and status = 'draft');

create policy "owners and managers update their venue"
  on public.venues for update
  using (public.is_venue_member(id, array['owner', 'manager']::public.venue_role[]))
  with check (public.is_venue_member(id, array['owner', 'manager']::public.venue_role[]));

create policy "owners delete their venue"
  on public.venues for delete
  using (public.is_venue_member(id, array['owner']::public.venue_role[]));

-- ─── venue_members ────────────────────────────────────────────────────────

create policy "members see their venue's team"
  on public.venue_members for select
  using (user_id = auth.uid() or public.is_venue_member(venue_id));

create policy "owners add members"
  on public.venue_members for insert
  to authenticated
  with check (
    public.is_venue_member(venue_id, array['owner']::public.venue_role[])
    -- bootstrap: venue creator adds themselves as owner
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1 from public.venues v
        where v.id = venue_id and v.created_by = auth.uid()
      )
    )
  );

create policy "owners update members"
  on public.venue_members for update
  using (public.is_venue_member(venue_id, array['owner']::public.venue_role[]))
  with check (public.is_venue_member(venue_id, array['owner']::public.venue_role[]));

create policy "owners remove members, members remove themselves"
  on public.venue_members for delete
  using (
    user_id = auth.uid()
    or public.is_venue_member(venue_id, array['owner']::public.venue_role[])
  );

-- ─── events ───────────────────────────────────────────────────────────────

create policy "published events of active venues are public"
  on public.events for select
  using (
    (
      status in ('published', 'soldout', 'past')
      and exists (
        select 1 from public.venues v
        where v.id = venue_id and v.status = 'active'
      )
    )
    or public.is_venue_member(venue_id)
  );

create policy "owners and managers create events"
  on public.events for insert
  to authenticated
  with check (public.is_venue_member(venue_id, array['owner', 'manager']::public.venue_role[]));

create policy "owners and managers update events"
  on public.events for update
  using (public.is_venue_member(venue_id, array['owner', 'manager']::public.venue_role[]))
  with check (public.is_venue_member(venue_id, array['owner', 'manager']::public.venue_role[]));

create policy "owners and managers delete draft events"
  on public.events for delete
  using (
    status = 'draft'
    and public.is_venue_member(venue_id, array['owner', 'manager']::public.venue_role[])
  );

-- ─── products ─────────────────────────────────────────────────────────────
-- sold_count/quota mutations happen ONLY via claim/release functions or the
-- service role; the update policy below still lets managers edit product
-- details, so the honest tickets-left counter comes from the same row.

create policy "products of visible events are readable"
  on public.products for select
  using (
    exists (
      select 1
      from public.events e
      join public.venues v on v.id = e.venue_id
      where e.id = event_id
        and e.status in ('published', 'soldout', 'past')
        and v.status = 'active'
    )
    or public.is_event_venue_member(event_id)
  );

create policy "owners and managers create products"
  on public.products for insert
  to authenticated
  with check (public.is_event_venue_member(event_id, array['owner', 'manager']::public.venue_role[]));

create policy "owners and managers update products"
  on public.products for update
  using (public.is_event_venue_member(event_id, array['owner', 'manager']::public.venue_role[]))
  with check (public.is_event_venue_member(event_id, array['owner', 'manager']::public.venue_role[]));

create policy "owners and managers delete unsold products"
  on public.products for delete
  using (
    sold_count = 0
    and public.is_event_venue_member(event_id, array['owner', 'manager']::public.venue_role[])
  );

-- ─── orders: created by Edge Functions only ───────────────────────────────

create policy "users read their own orders"
  on public.orders for select
  using (user_id = auth.uid());

create policy "venue staff read orders for their events"
  on public.orders for select
  using (public.is_event_venue_member(event_id, array['owner', 'manager']::public.venue_role[]));

-- no insert/update/delete policies: service role only (Stripe webhook flow)

-- ─── tickets: issued/mutated by Edge Functions only ───────────────────────

create policy "users read their own tickets"
  on public.tickets for select
  using (user_id = auth.uid());

create policy "venue staff read tickets for their events"
  on public.tickets for select
  using (public.is_event_venue_member(event_id));  -- includes door role (scanner, guestlist search)

-- no insert/update/delete policies: issue-tickets / validate-scan /
-- transfer / return all run server-side with the service role.

-- ─── waitlist ─────────────────────────────────────────────────────────────

create policy "users read their own waitlist entries"
  on public.waitlist for select
  using (user_id = auth.uid());

create policy "venue staff read waitlist for their events"
  on public.waitlist for select
  using (public.is_event_venue_member(event_id, array['owner', 'manager']::public.venue_role[]));

create policy "users leave the waitlist while waiting"
  on public.waitlist for delete
  using (user_id = auth.uid() and status = 'waiting');

-- inserts go through join_waitlist() (atomic FIFO position);
-- offer/purchase transitions are service-role only.

-- ─── profiles ─────────────────────────────────────────────────────────────

create policy "users read their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- insert happens via the on_auth_user_created trigger (security definer);
-- delete happens via the GDPR delete-account flow (cascades from auth.users).

-- PORTAL — demo seed (Phase 1 step 1)
-- 6 demo venues + 6 events across the 5 Cyprus cities.
-- NOTE: portal-app.html was not present in the repo when this seed was
-- written; these venues/events follow the spec (§1, §5) and must be
-- reconciled 1:1 with the prototype once the file is added.
--
-- Dates are relative to `now()` so the Tonight feed is always populated.
-- Prices follow hard rule 1: price_cents INCLUDES the €1.00 booking fee.

-- ─── Cities (§1) ──────────────────────────────────────────────────────────

insert into public.cities (id, name_el, name_en, slug) values
  ('c0000000-0000-4000-8000-000000000001', 'Λεμεσός',              'Limassol',           'lemesos'),
  ('c0000000-0000-4000-8000-000000000002', 'Λευκωσία',             'Nicosia',            'lefkosia'),
  ('c0000000-0000-4000-8000-000000000003', 'Αγία Νάπα / Πρωταράς', 'Ayia Napa / Protaras', 'agia-napa'),
  ('c0000000-0000-4000-8000-000000000004', 'Λάρνακα',              'Larnaca',            'larnaka'),
  ('c0000000-0000-4000-8000-000000000005', 'Πάφος',                'Paphos',             'pafos');

-- ─── Venues ───────────────────────────────────────────────────────────────

insert into public.venues (id, city_id, name, slug, description_el, description_en, address, geo, capacity, status) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'HALCYON', 'halcyon',
   'Techno δίπλα στη θάλασσα. Funktion-One, μπετόν και αλάτι.',
   'Techno by the sea. Funktion-One, concrete and salt.',
   'Παραλιακή Λεμεσού 47, Λεμεσός', point(33.0451, 34.6841), 450, 'active'),

  ('a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'VAULT 9', 'vault-9',
   'Υπόγειο στην εντός των τειχών. Σκοτεινό, δυνατό, χωρίς κάμερες.',
   'A basement inside the old walls. Dark, loud, no cameras.',
   'Λήδρας 9, Λευκωσία', point(33.3600, 35.1725), 250, 'active'),

  ('a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003',
   'MEDUSA', 'medusa',
   'Το superclub της Νάπας. Τρεις σκηνές, ένα καλοκαίρι.',
   'Ayia Napa''s superclub. Three stages, one summer.',
   'Λεωφόρος Νησί 12, Αγία Νάπα', point(33.9823, 34.9856), 1200, 'active'),

  ('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   'THE DOCKYARD', 'the-dockyard',
   'Warehouse parties στο παλιό λιμάνι. Ήχος βιομηχανικός, κόσμος δικός μας.',
   'Warehouse parties at the old port. Industrial sound, our kind of crowd.',
   'Παλιό Λιμάνι, Λεμεσός', point(33.0405, 34.6712), 800, 'active'),

  ('a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004',
   'CARBON', 'carbon',
   'Bar-club στα Φοινικούδια. Cocktails μέχρι τις 12, χορός μετά.',
   'Bar-club on Finikoudes. Cocktails till midnight, dancing after.',
   'Φοινικούδες 3, Λάρνακα', point(33.6367, 34.9159), 300, 'active'),

  ('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000005',
   'ONYX ROOF', 'onyx-roof',
   'Rooftop πάνω από το κάστρο. Ηλιοβασίλεμα, μετά house μέχρι το πρωί.',
   'A rooftop above the castle. Sunset first, then house till morning.',
   'Ποσειδώνος 21, Κάτω Πάφος', point(32.4076, 34.7539), 220, 'active');

-- ─── Events ───────────────────────────────────────────────────────────────
-- e1/e2: tonight · e3: tomorrow · e4: Saturday-ish (+2d) · e5: +3d · e6: +5d
-- e3 (MEDUSA) is SOLD OUT → demo waitlist flow.

insert into public.events (id, venue_id, name, slug, description_el, description_en, starts_at, doors_at, ends_at, genre, age_limit, status, lineup) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'RITUAL 013', 'ritual-013',
   'Peak-time techno, μηδέν φώτα κινητών. Το RITUAL επιστρέφει στο HALCYON.',
   'Peak-time techno, zero phone lights. RITUAL returns to HALCYON.',
   date_trunc('day', now()) + interval '23 hours',
   date_trunc('day', now()) + interval '22 hours',
   date_trunc('day', now()) + interval '1 day 5 hours',
   array['techno'], 18, 'published',
   '[{"name": "KLINT", "role": "headliner", "time": "01:00"},
     {"name": "Nadia P.", "role": "support", "time": "23:30"},
     {"name": "Aeon", "role": "opener", "time": "22:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005',
   'VELVET NIGHTS', 'velvet-nights',
   'Disco και house κλασικά στα Φοινικούδια. Dress code: ό,τι σε κάνει να λάμπεις.',
   'Disco and house classics on Finikoudes. Dress code: whatever makes you shine.',
   date_trunc('day', now()) + interval '22 hours',
   date_trunc('day', now()) + interval '21 hours',
   date_trunc('day', now()) + interval '1 day 3 hours',
   array['disco', 'house'], 21, 'published',
   '[{"name": "Miss Adamou", "role": "resident", "time": "22:00"},
     {"name": "Roula V.", "role": "guest", "time": "00:30"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'NEPTUNE FOAM PARTY', 'neptune-foam-party',
   'Το μεγαλύτερο foam party του νησιού. Τρεις σκηνές, αφρός μέχρι τη μέση.',
   'The island''s biggest foam party. Three stages, foam up to your waist.',
   date_trunc('day', now()) + interval '1 day 23 hours',
   date_trunc('day', now()) + interval '1 day 22 hours',
   date_trunc('day', now()) + interval '2 days 6 hours',
   array['edm', 'house'], 18, 'soldout',
   '[{"name": "TWIN FLAME", "role": "headliner", "time": "01:30"},
     {"name": "DJ Sfera", "role": "support", "time": "23:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004',
   'DOCKYARD 04: CONCRETE', 'dockyard-04-concrete',
   'Industrial techno στο παλιό λιμάνι. 8 ώρες, ένα stage, καθόλου φιοριτούρες.',
   'Industrial techno at the old port. 8 hours, one stage, no frills.',
   date_trunc('day', now()) + interval '2 days 23 hours',
   date_trunc('day', now()) + interval '2 days 22 hours',
   date_trunc('day', now()) + interval '3 days 7 hours',
   array['techno', 'industrial'], 18, 'published',
   '[{"name": "VESSEL 8", "role": "headliner", "time": "02:00"},
     {"name": "Mara K.", "role": "support", "time": "00:00"},
     {"name": "Subterra", "role": "opener", "time": "22:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   'BASSMENT SESSIONS', 'bassment-sessions',
   'Drum & bass στο υπόγειο. Χαμηλό ταβάνι, ψηλά BPM.',
   'Drum & bass in the basement. Low ceiling, high BPM.',
   date_trunc('day', now()) + interval '3 days 23 hours',
   date_trunc('day', now()) + interval '3 days 22 hours',
   date_trunc('day', now()) + interval '4 days 4 hours',
   array['dnb', 'bass'], 18, 'published',
   '[{"name": "Hexen", "role": "headliner", "time": "01:00"},
     {"name": "Kyra", "role": "opener", "time": "23:00"}]'::jsonb),

  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006',
   'GOLDEN HOUR', 'golden-hour',
   'Sunset session στην ταράτσα. Afro house όσο πέφτει ο ήλιος, μετά melodic μέχρι αργά.',
   'Sunset session on the roof. Afro house as the sun goes down, then melodic till late.',
   date_trunc('day', now()) + interval '5 days 19 hours',
   date_trunc('day', now()) + interval '5 days 18 hours',
   date_trunc('day', now()) + interval '6 days 2 hours',
   array['afro house', 'melodic'], 21, 'published',
   '[{"name": "Selene", "role": "resident", "time": "19:00"},
     {"name": "L. Charalambous", "role": "guest", "time": "22:00"}]'::jsonb);

-- ─── Products ─────────────────────────────────────────────────────────────
-- price_cents includes fee_cents (€1.00 = 100). Guestlist is always free.
-- Tables: min spend + 30% deposit (hard rule 5).

insert into public.products
  (id, event_id, type, name, price_cents, fee_cents, quota, sold_count, per_order_limit,
   sales_start, sales_end, gl_cutoff_time, table_min_spend_cents, table_capacity, deposit_pct)
values
  -- RITUAL 013 @ HALCYON — early bird gone, 2nd release selling fast
  ('b0000000-0000-4000-8000-000000000101', 'e0000000-0000-4000-8000-000000000001', 'ticket',
   'Early Bird', 1200, 100, 100, 100, 4,
   now() - interval '21 days', now() - interval '7 days', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000102', 'e0000000-0000-4000-8000-000000000001', 'ticket',
   '2nd Release', 1500, 100, 200, 178, 4,
   now() - interval '7 days', date_trunc('day', now()) + interval '23 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000103', 'e0000000-0000-4000-8000-000000000001', 'guestlist',
   'Guestlist', 0, 0, 80, 41, 2,
   now() - interval '7 days', null, date_trunc('day', now()) + interval '23 hours 30 minutes', null, null, null),
  ('b0000000-0000-4000-8000-000000000104', 'e0000000-0000-4000-8000-000000000001', 'table',
   'VIP Table — Seafront', 0, 0, 6, 4, 1,
   now() - interval '21 days', date_trunc('day', now()) + interval '21 hours', null, 30000, 6, 30),

  -- VELVET NIGHTS @ CARBON
  ('b0000000-0000-4000-8000-000000000201', 'e0000000-0000-4000-8000-000000000002', 'ticket',
   'General Admission', 1000, 100, 180, 92, 6,
   now() - interval '10 days', date_trunc('day', now()) + interval '22 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000202', 'e0000000-0000-4000-8000-000000000002', 'guestlist',
   'Guestlist πριν τις 23:00', 0, 0, 60, 18, 3,
   now() - interval '10 days', null, date_trunc('day', now()) + interval '23 hours', null, null, null),
  ('b0000000-0000-4000-8000-000000000203', 'e0000000-0000-4000-8000-000000000002', 'table',
   'Booth — Terrace', 0, 0, 4, 1, 1,
   now() - interval '10 days', date_trunc('day', now()) + interval '20 hours', null, 20000, 8, 30),

  -- NEPTUNE FOAM PARTY @ MEDUSA — everything sold out → waitlist demo
  ('b0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000003', 'ticket',
   'Early Bird', 2000, 100, 400, 400, 6,
   now() - interval '30 days', now() - interval '14 days', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000302', 'e0000000-0000-4000-8000-000000000003', 'ticket',
   'Final Release', 2500, 100, 600, 600, 6,
   now() - interval '14 days', now() + interval '1 day', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000303', 'e0000000-0000-4000-8000-000000000003', 'table',
   'VIP Cabana', 0, 0, 10, 10, 1,
   now() - interval '30 days', now() + interval '1 day', null, 50000, 10, 30),

  -- DOCKYARD 04 @ THE DOCKYARD
  ('b0000000-0000-4000-8000-000000000401', 'e0000000-0000-4000-8000-000000000004', 'ticket',
   'Early Bird', 1300, 100, 250, 250, 4,
   now() - interval '14 days', now() - interval '2 days', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000402', 'e0000000-0000-4000-8000-000000000004', 'ticket',
   '2nd Release', 1700, 100, 350, 121, 4,
   now() - interval '2 days', now() + interval '2 days 22 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000403', 'e0000000-0000-4000-8000-000000000004', 'guestlist',
   'Guestlist', 0, 0, 100, 12, 2,
   now() - interval '2 days', null, date_trunc('day', now()) + interval '2 days 23 hours', null, null, null),

  -- BASSMENT SESSIONS @ VAULT 9
  ('b0000000-0000-4000-8000-000000000501', 'e0000000-0000-4000-8000-000000000005', 'ticket',
   'General Admission', 1100, 100, 200, 34, 4,
   now() - interval '5 days', now() + interval '3 days 22 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000502', 'e0000000-0000-4000-8000-000000000005', 'guestlist',
   'Guestlist πριν τις 23:30', 0, 0, 50, 7, 2,
   now() - interval '5 days', null, date_trunc('day', now()) + interval '3 days 23 hours 30 minutes', null, null, null),

  -- GOLDEN HOUR @ ONYX ROOF
  ('b0000000-0000-4000-8000-000000000601', 'e0000000-0000-4000-8000-000000000006', 'ticket',
   'Sunset Ticket', 1500, 100, 150, 63, 4,
   now() - interval '7 days', now() + interval '5 days 18 hours', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000602', 'e0000000-0000-4000-8000-000000000006', 'guestlist',
   'Guestlist πριν τις 20:00', 0, 0, 40, 22, 2,
   now() - interval '7 days', null, date_trunc('day', now()) + interval '5 days 20 hours', null, null, null),
  ('b0000000-0000-4000-8000-000000000603', 'e0000000-0000-4000-8000-000000000006', 'table',
   'Table — Castle View', 0, 0, 8, 2, 1,
   now() - interval '7 days', now() + interval '5 days 16 hours', null, 25000, 6, 30);
