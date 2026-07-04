-- PORTAL — Phase 3 groundwork: media storage, team visibility,
-- email lookup for transfers/invites, GDPR-safe account deletion.

-- ─── Media bucket (event covers, venue logos) ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public reads media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "authenticated users upload media they own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media' and owner = auth.uid());

create policy "owners replace their media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

create policy "owners delete their media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

-- ─── Team visibility: members of the same venue see each other's profile ──
create policy "venue members read teammate profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.venue_members me
      join public.venue_members them on them.venue_id = me.venue_id
      where me.user_id = auth.uid()
        and them.user_id = profiles.id
    )
  );

-- ─── Email → user id lookup (server-side only) ────────────────────────────
-- Used by transfer-ticket and add-venue-member Edge Functions. Never
-- exposed to clients: knowing who has an account here is private.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

-- ─── GDPR delete-account: history survives, identity goes ─────────────────
-- Tickets/orders are financial records; deleting a user anonymizes them
-- instead of destroying them (data minimization ≠ bookkeeping destruction).
alter table public.tickets alter column user_id drop not null;
alter table public.tickets drop constraint tickets_user_id_fkey;
alter table public.tickets
  add constraint tickets_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

alter table public.tickets drop constraint tickets_scanned_by_fkey;
alter table public.tickets
  add constraint tickets_scanned_by_fkey
  foreign key (scanned_by) references auth.users (id) on delete set null;

alter table public.tickets drop constraint tickets_transferred_to_fkey;
alter table public.tickets
  add constraint tickets_transferred_to_fkey
  foreign key (transferred_to) references auth.users (id) on delete set null;

alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
