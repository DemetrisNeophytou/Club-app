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
