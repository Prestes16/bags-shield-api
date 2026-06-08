-- Rollback for scan-paywall.sql. Drops the paywall RPCs and tables.
-- Destructive: removes the scan usage ledger and payment intents (audit data).
-- Does NOT touch user_scans or any launchpad table.

drop function if exists public.consume_paid_scan(uuid, text);
drop function if exists public.claim_free_scan(uuid, text, int);

drop table if exists public.scan_payment_intents;
drop table if exists public.scan_usage_ledger;
