#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/kits-consent.XXXXXX")
cleanup() { pg_ctl -D "$tmp/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT INT TERM
initdb -D "$tmp/db" -A trust --no-locale >/dev/null
pg_ctl -D "$tmp/db" -o "-F -k $tmp -p 55473 -c listen_addresses=''" -l "$tmp/log" start >/dev/null
export PGHOST="$tmp" PGPORT=55473 PGDATABASE=postgres
psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role anon; create role authenticated;
create schema auth; create schema kitsnode_member_private;
create table auth.users(id uuid primary key, raw_app_meta_data jsonb, raw_user_meta_data jsonb);
create table public.kitsnode_member_consents(user_id uuid not null references auth.users(id) on delete cascade, terms_version text not null, privacy_version text not null, accepted_at timestamptz not null default now(), primary key(user_id,terms_version,privacy_version));
SQL
psql -X -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261116160717_member_signup_consent.sql" >/dev/null
psql -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into auth.users values
('00000000-0000-0000-0000-000000000001','{"provider":"email"}','{"kitsnode_consent":{"termsVersion":"2026-11-14","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}'),
('00000000-0000-0000-0000-000000000002','{"provider":"custom:naver"}','{"kitsnode_consent":{"termsVersion":"2026-11-14","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}'),
('00000000-0000-0000-0000-000000000003','{"provider":"email"}','{"kitsnode_consent":{"termsVersion":"old","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}'),
('00000000-0000-0000-0000-000000000004','{"provider":"email"}','{"kitsnode_consent":{"termsVersion":"2026-11-14","privacyVersion":"2026-11-14-naver","termsAccepted":"true","privacyAcknowledged":true}}');
do $$ begin
 if (select count(*) from public.kitsnode_member_consents) <> 1 or not exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-0000-0000-000000000001') then raise exception 'incorrect initial records'; end if;
end $$;
delete from public.kitsnode_member_consents where user_id='00000000-0000-0000-0000-000000000001';
update auth.users set raw_user_meta_data='{"kitsnode_consent":{"termsVersion":"2026-11-14","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}' where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
do $$ begin
 if exists(select 1 from public.kitsnode_member_consents) then raise exception 'metadata update recreated consent'; end if;
 if has_function_privilege('anon','kitsnode_member_private.record_signup_consent()','EXECUTE') or has_function_privilege('authenticated','kitsnode_member_private.record_signup_consent()','EXECUTE') then raise exception 'trigger function exposed'; end if;
end $$;
SQL
printf '%s\n' 'Signup consent SQL checks passed.'
