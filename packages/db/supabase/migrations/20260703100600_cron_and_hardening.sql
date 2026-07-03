-- Applied to production 2026-07-03 via MCP (schedule_process_waitlist +
-- security_hardening_advisors). Kept here so local/dev rebuilds match.

-- Waitlist sweeper: every 5 minutes, poke the process-waitlist Edge
-- Function so lapsed 30-min offers pass to the next person in line.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'process-waitlist-sweep',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://mxmehizzrlrbegrujdjp.supabase.co/functions/v1/process-waitlist',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Advisor fixes: pin search_path (hijack protection) and pull the
-- signup trigger body off the exposed RPC surface.
alter function public.set_updated_at() set search_path = public;
alter function public.gen_ticket_code() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
