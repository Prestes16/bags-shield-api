-- Bags Shield Launchpad provenance for the user_launches feed.
-- Run once in Supabase SQL editor before enabling the public Launchpad feed.
-- This migration is intentionally non-destructive and does not backfill old rows
-- as app_created=true. Existing/demo/imported rows remain excluded by the API.

alter table public.user_launches
  add column if not exists creator_wallet text,
  add column if not exists launch_wallet text,
  add column if not exists tx_signature text,
  add column if not exists launch_status text default 'pending',
  add column if not exists origin text default 'bags-shield-launchpad',
  add column if not exists app_created boolean default false,
  add column if not exists is_demo boolean default false,
  add column if not exists is_imported boolean default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists metadata_uri text,
  add column if not exists config_key text,
  add column if not exists updated_at timestamptz;

create index if not exists idx_user_launches_feed_real
  on public.user_launches (app_created, origin, launch_status, created_at desc);
