-- PORTAL — enable Realtime for the live sales view (spec §6.3).
-- postgres_changes only fires for tables in the supabase_realtime
-- publication; RLS still applies per subscriber.

alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.orders;
