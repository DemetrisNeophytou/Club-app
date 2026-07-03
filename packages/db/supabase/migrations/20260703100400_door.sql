-- PORTAL — Door mode support (spec §7).
-- Venue staff need ticket-holder names for the door manifest, guestlist
-- search and the guestlist manager (§6.4). Scoped strictly: only profiles
-- of people holding a ticket to one of THEIR venue's events.

create policy "venue staff read ticket-holder profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.tickets tk
      where tk.user_id = profiles.id
        and public.is_event_venue_member(tk.event_id)
    )
  );
