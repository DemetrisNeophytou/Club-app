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
