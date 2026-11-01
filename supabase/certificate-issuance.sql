-- Dial & Ledger secure certificate issuance.
-- Run AFTER certificate-verification.sql in Supabase SQL Editor.
-- Admins must be explicitly allowlisted by their Supabase Auth user UUID.

create table if not exists public.certificate_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.certificate_admins enable row level security;
revoke all on table public.certificate_admins from public, anon, authenticated;

-- Only an authenticated, allowlisted administrator can issue a certificate.
-- The code is generated inside PostgreSQL from a random UUID (122 bits of entropy).
create or replace function public.issue_certificate(
  p_watch_brand text,
  p_watch_model text,
  p_watch_reference text default null,
  p_serial_last4 text default null,
  p_issue_date date default current_date,
  p_warranty_until date default null
)
returns table (
  certificate_code text,
  certificate_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.certificate_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Not authorised to issue certificates' using errcode = '42501';
  end if;

  if nullif(trim(p_watch_brand), '') is null
     or nullif(trim(p_watch_model), '') is null then
    raise exception 'Watch brand and model are required' using errcode = '22023';
  end if;

  if length(trim(p_watch_brand)) > 100
     or length(trim(p_watch_model)) > 150
     or length(coalesce(p_watch_reference, '')) > 100
     or length(coalesce(p_serial_last4, '')) > 4 then
    raise exception 'One or more certificate fields are too long' using errcode = '22023';
  end if;

  if p_issue_date is null then
    raise exception 'Issue date is required' using errcode = '22023';
  end if;

  if p_warranty_until is not null and p_warranty_until < p_issue_date then
    raise exception 'Warranty end date cannot be before issue date' using errcode = '22023';
  end if;

  -- UUID-derived 32-character code, generated only on the server.
  v_code := upper(replace(gen_random_uuid()::text, '-', ''));

  insert into public.certificates (
    code, watch_brand, watch_model, watch_reference, serial_last4,
    issue_date, warranty_until, status
  ) values (
    v_code, trim(p_watch_brand), trim(p_watch_model),
    nullif(trim(coalesce(p_watch_reference, '')), ''),
    nullif(trim(coalesce(p_serial_last4, '')), ''),
    p_issue_date, p_warranty_until, 'active'
  );

  return query select v_code, 'active'::text;
end;
$$;

revoke all on function public.issue_certificate(text,text,text,text,date,date) from public, anon;
grant execute on function public.issue_certificate(text,text,text,text,date,date) to authenticated;

comment on table public.certificate_admins is
  'Allowlist of Supabase Auth users permitted to issue certificates.';
comment on function public.issue_certificate(text,text,text,text,date,date) is
  'Creates a certificate using a server-generated random code. Requires an authenticated allowlisted administrator.';
