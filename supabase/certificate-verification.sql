-- Dial & Ledger public certificate verification foundation.
-- Run this in Supabase SQL Editor. Issuance is intentionally server-only.
create table if not exists public.certificates (
  code text primary key,
  watch_brand text not null,
  watch_model text not null,
  watch_reference text,
  serial_last4 text,
  issue_date date not null,
  warranty_until date,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint certificate_code_format check (code ~ '^[A-Z0-9-]{20,80}$'),
  constraint certificate_revocation_consistency check (
    (status = 'active' and revoked_at is null) or
    (status = 'revoked' and revoked_at is not null)
  )
);

alter table public.certificates enable row level security;
revoke all on table public.certificates from anon, authenticated;
grant select, insert, update, delete on table public.certificates to service_role;

create or replace function public.verify_certificate_result(p_code text)
returns table (
  found boolean,
  certificate_status text,
  watch_brand text,
  watch_model text,
  watch_reference text,
  serial_last4 text,
  issue_date date,
  warranty_until date
)
language sql
stable
security definer
set search_path = ''
as $$
  select true, c.status, c.watch_brand, c.watch_model, c.watch_reference,
         c.serial_last4, c.issue_date, c.warranty_until
  from public.certificates c
  where c.code = upper(trim(p_code))
  union all
  select false, null::text, null::text, null::text, null::text,
         null::text, null::date, null::date
  where not exists (
    select 1 from public.certificates c
    where c.code = upper(trim(p_code))
  )
  limit 1
$$;

revoke all on function public.verify_certificate_result(text) from public;
grant execute on function public.verify_certificate_result(text) to anon, authenticated;

comment on table public.certificates is
  'Public verification metadata only. Never store customer contact details, invoice totals, or private notes here.';
comment on function public.verify_certificate_result(text) is
  'Exact-code lookup returning limited certificate metadata; public callers cannot read or modify the table directly.';
