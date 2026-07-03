-- PORTAL — waitlist resale + push notifications (spec §4 rule 2, Phase 2.6).

-- An offer reserves a specific returned ticket for a specific waiter.
alter table public.waitlist
  add column offered_ticket_id uuid references public.tickets (id);

create index waitlist_pairing_idx on public.waitlist (product_id, status);

-- Expo push tokens: one row per device token, owned by its user.
create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "users manage their own push tokens"
  on public.push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
