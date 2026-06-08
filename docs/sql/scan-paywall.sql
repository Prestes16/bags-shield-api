-- Bags Shield Scanner paywall: per-account daily free quota + paid extra scans.
-- Run once in the Supabase SQL editor (or via MCP). Non-destructive: does not
-- touch user_scans (analytics) or any launchpad table. Day boundary is UTC.
--
-- Model (no plans / no subscriptions):
--   * N free scans per UTC day per user_id (default 3, env SCAN_FREE_DAILY_LIMIT).
--   * After the limit, each extra scan requires an individual micro-payment to the
--     Bags Shield treasury, verified on-chain, single-use.
--
-- Security:
--   * RLS is enabled on both tables with NO policies -> anon/authenticated get
--     zero rows and cannot read/write. The backend uses the service_role key,
--     which has BYPASSRLS, so it is the only path to this data.
--   * The RPCs are SECURITY DEFINER and EXECUTE is granted to service_role only;
--     EXECUTE is revoked from public/anon/authenticated so end users cannot call
--     them through PostgREST.

-- == Append-only usage ledger ==============================================
create table if not exists public.scan_usage_ledger (
  id              bigint generated always as identity primary key,
  user_id         uuid    not null,
  mint            text,
  kind            text    not null check (kind in ('free_scan','paid_scan')),
  tx_signature    text,
  amount_lamports bigint,
  scan_date       date    not null,                 -- UTC day
  free_seq        int,                              -- 1..limit for free_scan, null for paid
  created_at      timestamptz not null default now(),
  metadata        jsonb
);

-- Atomic free quota: at most one row per (user_id, scan_date, free_seq). The
-- per-day sequence + unique index makes two concurrent tabs unable to exceed the
-- limit (the second insert with the same seq fails).
create unique index if not exists uq_scan_free_seq
  on public.scan_usage_ledger (user_id, scan_date, free_seq)
  where kind = 'free_scan';

create index if not exists idx_scan_ledger_user_day
  on public.scan_usage_ledger (user_id, scan_date);

-- A confirmed payment signature can only ever back one paid scan (replay guard).
create unique index if not exists uq_scan_paid_sig
  on public.scan_usage_ledger (tx_signature)
  where tx_signature is not null;

-- == Payment intents (one quote = one extra scan) ==========================
create table if not exists public.scan_payment_intents (
  id               bigint generated always as identity primary key,
  user_id          uuid    not null,
  mint             text,
  price_lamports   bigint  not null,
  treasury_wallet  text    not null,
  reference        text    not null unique,         -- unpredictable; used as on-chain memo
  status           text    not null default 'pending'
                     check (status in ('pending','paid','expired','used')),
  signature        text    unique,                  -- set on verify; unique = replay guard
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  metadata         jsonb
);

create index if not exists idx_scan_intents_user_status
  on public.scan_payment_intents (user_id, status);

create index if not exists idx_scan_intents_lookup
  on public.scan_payment_intents (user_id, mint, status);

-- == Atomic free-scan claim =================================================
-- Returns the free_seq used (1..p_limit) on success, or -1 when the daily free
-- limit is already reached. Retries once on a race (unique_violation).
create or replace function public.claim_free_scan(p_user_id uuid, p_mint text, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day  date := (now() at time zone 'utc')::date;
  v_seq  int;
  v_try  int := 0;
begin
  loop
    v_try := v_try + 1;
    select coalesce(max(free_seq), 0) + 1
      into v_seq
      from public.scan_usage_ledger
     where user_id = p_user_id and scan_date = v_day and kind = 'free_scan';

    if v_seq > p_limit then
      return -1;
    end if;

    begin
      insert into public.scan_usage_ledger (user_id, mint, kind, scan_date, free_seq)
        values (p_user_id, p_mint, 'free_scan', v_day, v_seq);
      return v_seq;
    exception when unique_violation then
      if v_try >= 5 then
        return -1;
      end if;
      -- another tab took this seq; recompute and retry
    end;
  end loop;
end;
$$;

-- == Atomic paid-scan consume ===============================================
-- Picks one 'paid' intent for (p_user_id [, p_mint]), flips it to 'used', and
-- inserts the paid_scan ledger row in the SAME transaction. Returns true only
-- when a scan was granted AND audited. FOR UPDATE SKIP LOCKED prevents two
-- concurrent requests from consuming the same intent.
create or replace function public.consume_paid_scan(p_user_id uuid, p_mint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.scan_payment_intents%rowtype;
begin
  select *
    into v_intent
    from public.scan_payment_intents
   where user_id = p_user_id
     and status = 'paid'
     and (p_mint is null or mint = p_mint)
   order by created_at asc
   for update skip locked
   limit 1;

  if not found then
    return false;
  end if;

  update public.scan_payment_intents
     set status = 'used'
   where id = v_intent.id and status = 'paid';

  if not found then
    return false;
  end if;

  insert into public.scan_usage_ledger
    (user_id, mint, kind, tx_signature, amount_lamports, scan_date)
  values
    (p_user_id, p_mint, 'paid_scan', v_intent.signature, v_intent.price_lamports,
     (now() at time zone 'utc')::date);

  return true;
end;
$$;

-- == RLS lockdown ===========================================================
alter table public.scan_usage_ledger    enable row level security;
alter table public.scan_payment_intents enable row level security;
-- No policies are created on purpose: with RLS enabled and no policy, anon and
-- authenticated cannot see or change any row. service_role (BYPASSRLS) is the
-- only accessor. Also revoke table grants for defense in depth.
revoke all on public.scan_usage_ledger    from anon, authenticated;
revoke all on public.scan_payment_intents from anon, authenticated;

-- Lock the RPCs to the backend (service_role) only.
revoke all on function public.claim_free_scan(uuid, text, int) from public, anon, authenticated;
grant  execute on function public.claim_free_scan(uuid, text, int) to service_role;
revoke all on function public.consume_paid_scan(uuid, text)    from public, anon, authenticated;
grant  execute on function public.consume_paid_scan(uuid, text)    to service_role;
