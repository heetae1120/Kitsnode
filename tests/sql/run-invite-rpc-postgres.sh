#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
d=$(mktemp -d "${TMPDIR:-/tmp}/kits-consent-rpc.XXXXXXXX")
started=0
cleanup(){ if [ "$started" = 1 ]; then pg_ctl -D "$d/data" stop -m fast >/dev/null 2>&1 || true; fi; rm -rf "$d"; }
trap cleanup EXIT INT TERM
initdb -D "$d/data" -A trust --no-instructions >"$d/init.log"
pg_ctl -D "$d/data" -o "-p 56415 -k $d -c listen_addresses=" -l "$d/server.log" start >/dev/null
started=1
psql -X -q -h "$d" -p 56415 -d postgres -v ON_ERROR_STOP=1 -c "create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz); insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); insert into auth.sessions(id,user_id) values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');" >/dev/null
psql -X -q -h "$d" -p 56415 -d postgres -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261121055943_kitsnode_invite_consent_recording.sql" >/dev/null
KITS_CONSENT_PG_SOCKET="$d" KITS_CONSENT_PG_MODULE="${KITS_CONSENT_PG_MODULE:?set node_modules parent with pg installed}" node --test "$root/tests/invite-consent-rpc-integration.test.mjs"
psql -X -q -h "$d" -p 56415 -d postgres -v ON_ERROR_STOP=1 -f "$root/docs/invite-consent-rollback.sql" >/dev/null
psql -X -q -h "$d" -p 56415 -d postgres -v ON_ERROR_STOP=1 -c "select to_regclass('kitsnode_ads_private.invite_consent_candidate') is null;" | rg -q 't' >/dev/null
