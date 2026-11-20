#!/bin/sh
# Private isolated PostgreSQL only. Simulates Auth's transactional admin delete.
set -eu
KITS_PG_BIN=${KITS_PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
KITS_DELETE_TMP=$(mktemp -d "${TMPDIR:-/tmp}/kits-admin-delete.XXXXXX")
started=0
cleanup(){ if [ "$started" = 1 ]; then "$KITS_PG_BIN/pg_ctl" -D "$KITS_DELETE_TMP/db" -m fast -w stop >/dev/null; fi; rm -rf "$KITS_DELETE_TMP"; }
trap cleanup EXIT HUP INT TERM
"$KITS_PG_BIN/initdb" -D "$KITS_DELETE_TMP/db" --auth-local=trust --auth-host=reject --no-locale >/dev/null
"$KITS_PG_BIN/pg_ctl" -D "$KITS_DELETE_TMP/db" -l "$KITS_DELETE_TMP/log" -o "-k $KITS_DELETE_TMP -p 55446 -c listen_addresses=''" -w start >/dev/null
started=1
PSQL="$KITS_PG_BIN/psql"
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_auth_admin;
CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE SCHEMA vault;CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);INSERT INTO vault.decrypted_secrets VALUES ('kitsnode_deleted_identity_hmac_v1','synthetic-only-local-hmac-key-1234567890');
CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE SCHEMA kits_ai_private;CREATE SCHEMA kitsnode_ads_private;CREATE SCHEMA kitsnode_ads_test_20261117;
CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE auth.sessions(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE auth.audit_log_entries(action text,user_id uuid);
CREATE TABLE public.kitsnode_member_consents(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE kits_ai_private.staff(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE kitsnode_ads_private.connections(user_id uuid REFERENCES auth.users(id),approved_by uuid);
CREATE TABLE kitsnode_ads_private.attempts(owner_id uuid);CREATE TABLE kitsnode_ads_private.ownership_evidence(user_id uuid,recorded_by uuid,revoked_by uuid);CREATE TABLE kitsnode_ads_private.request_limits(user_id uuid);
CREATE TABLE kitsnode_ads_test_20261117.connections(user_id uuid REFERENCES auth.users(id),approved_by uuid);CREATE TABLE kitsnode_ads_test_20261117.attempts(owner_id uuid);CREATE TABLE kitsnode_ads_test_20261117.ownership_evidence(user_id uuid,recorded_by uuid,revoked_by uuid);CREATE TABLE kitsnode_ads_test_20261117.request_limits(user_id uuid);
CREATE TABLE storage.objects(owner uuid,owner_id text);
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;GRANT DELETE,SELECT ON auth.users TO supabase_auth_admin;GRANT INSERT ON auth.audit_log_entries TO supabase_auth_admin;
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
INSERT INTO auth.sessions SELECT id FROM auth.users;INSERT INTO public.kitsnode_member_consents SELECT id FROM auth.users;
INSERT INTO kits_ai_private.staff VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO kitsnode_ads_private.connections(user_id) VALUES ('22222222-2222-4222-8222-222222222222');
INSERT INTO storage.objects VALUES (NULL,'33333333-3333-4333-8333-333333333333');
SQL
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -f "${KITS_DELETE_MIGRATION:-$(dirname "$0")/../supabase/functions/kitsnode-member-delete/delete-admin-trigger-no-record-review.sql}" >/dev/null
for user in 11111111-1111-4111-8111-111111111111 22222222-2222-4222-8222-222222222222 33333333-3333-4333-8333-333333333333; do
 if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE supabase_auth_admin; BEGIN; INSERT INTO auth.audit_log_entries VALUES ('user_deleted','$user'); DELETE FROM auth.users WHERE id='$user'; COMMIT;" >"$KITS_DELETE_TMP/error" 2>&1; then printf '%s\n' 'Unexpected protected deletion' >&2; exit 1; fi
done
# Unknown UUIDs are refused by this alternative; existing rows are not touched.
if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO kitsnode_ads_private.ownership_evidence(recorded_by) VALUES ('99999999-9999-4999-8999-999999999999')" >"$KITS_DELETE_TMP/unmapped" 2>&1; then printf '%s\n' 'Unmapped actor unexpectedly accepted' >&2; exit 1; fi
if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO storage.objects(owner_id) VALUES ('99999999-9999-4999-8999-999999999999')" >"$KITS_DELETE_TMP/unmapped" 2>&1; then printf '%s\n' 'Unmapped Storage owner unexpectedly accepted' >&2; exit 1; fi
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF to_regclass('kitsnode_member_private.deleted_identity_candidate') IS NOT NULL THEN RAISE EXCEPTION 'unexpected deletion marker'; END IF; END \$\$" >/dev/null
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
SET ROLE service_role;
DO $$ BEGIN
 IF public.kitsnode_delete_member_precheck('11111111-1111-4111-8111-111111111111') IS DISTINCT FROM true THEN RAISE EXCEPTION 'staff precheck failure'; END IF;
 IF public.kitsnode_delete_member_precheck('44444444-4444-4444-8444-444444444444') IS DISTINCT FROM false THEN RAISE EXCEPTION 'member precheck failure'; END IF;
 IF has_function_privilege('anon','public.kitsnode_delete_member_precheck(uuid)','EXECUTE') OR has_function_privilege('authenticated','public.kitsnode_delete_member_precheck(uuid)','EXECUTE') THEN RAISE EXCEPTION 'unexpected precheck grant'; END IF;
END $$;
DO $$ DECLARE i integer; ok boolean; BEGIN
 FOR i IN 1..6 LOOP SELECT public.kitsnode_delete_member_limit('44444444-4444-4444-8444-444444444444') INTO ok; IF ok IS DISTINCT FROM (i<=5) THEN RAISE EXCEPTION 'limiter failed'; END IF; END LOOP;
END $$;
RESET ROLE;
SET ROLE supabase_auth_admin;
BEGIN;INSERT INTO auth.audit_log_entries VALUES ('user_deleted','44444444-4444-4444-8444-444444444444');DELETE FROM auth.users WHERE id='44444444-4444-4444-8444-444444444444';COMMIT;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM auth.audit_log_entries)<>1 THEN RAISE EXCEPTION 'audit rollback failed'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id='44444444-4444-4444-8444-444444444444') OR EXISTS(SELECT 1 FROM auth.sessions WHERE user_id='44444444-4444-4444-8444-444444444444') OR EXISTS(SELECT 1 FROM public.kitsnode_member_consents WHERE user_id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'cascade failed'; END IF;
 IF (SELECT count(*) FROM auth.users)<>3 THEN RAISE EXCEPTION 'protected users changed'; END IF;
END $$;
SQL
# UUID-form Storage owner IDs compare case-insensitively; malformed values
# must not fail the entire precheck or be interpreted as member IDs.
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO storage.objects(owner_id) VALUES ('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'),('not-a-uuid'),('');
DO $$ BEGIN IF public.kitsnode_delete_member_precheck('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS DISTINCT FROM true THEN RAISE EXCEPTION 'uppercase owner missed'; END IF; END $$;
SQL
if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "DELETE FROM auth.users WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'" >"$KITS_DELETE_TMP/uppercase-error" 2>&1; then printf '%s\n' 'Uppercase Storage owner not protected' >&2;exit 1;fi
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DELETE FROM storage.objects WHERE owner_id='AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
DO $$ BEGIN IF public.kitsnode_delete_member_precheck('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS DISTINCT FROM false THEN RAISE EXCEPTION 'malformed owner affected precheck'; END IF; END $$;
DELETE FROM auth.users WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SQL
# A new protected reference after a negative precheck is still stopped by the
# final DELETE trigger; callers must not report this race as a confirmed 409.
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users VALUES ('77777777-7777-4777-8777-777777777777');
DO $$ BEGIN IF public.kitsnode_delete_member_precheck('77777777-7777-4777-8777-777777777777') IS DISTINCT FROM false THEN RAISE EXCEPTION 'precheck failure'; END IF; END $$;
INSERT INTO kits_ai_private.staff VALUES ('77777777-7777-4777-8777-777777777777');
SQL
if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "DELETE FROM auth.users WHERE id='77777777-7777-4777-8777-777777777777'" >"$KITS_DELETE_TMP/race-error" 2>&1; then printf '%s\n' 'Final trigger failed' >&2;exit 1;fi
# Every known FK-free owner/actor reference independently blocks deletion.
KITS_ID=100
for pair in attempts:owner_id ownership_evidence:user_id request_limits:user_id connections:approved_by ownership_evidence:recorded_by ownership_evidence:revoked_by; do
 for schema in kitsnode_ads_private kitsnode_ads_test_20261117; do
 relation=${pair%:*}; owner_column=${pair#*:}; user=$(printf '88888888-8888-4888-8888-%012d' "$KITS_ID"); KITS_ID=$((KITS_ID+1))
 "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users VALUES ('$user'); INSERT INTO $schema.$relation($owner_column) VALUES ('$user')" >/dev/null
 KITS_PRECHECK=$("$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -tA -c "SELECT public.kitsnode_delete_member_precheck('$user')"); [ "$KITS_PRECHECK" = t ] || { printf '%s\n' 'Actor precheck failed' >&2;exit 1; }
 if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "DELETE FROM auth.users WHERE id='$user'" >"$KITS_DELETE_TMP/actor-error" 2>&1; then printf '%s\n' 'Unexpected actor deletion' >&2;exit 1;fi
 "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "DELETE FROM $schema.$relation WHERE $owner_column='$user'; DELETE FROM auth.users WHERE id='$user'" >/dev/null
 done
done
# A Storage insert must wait on the same user row and fail after deletion.
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users VALUES ('55555555-5555-4555-8555-555555555555')" >/dev/null
"$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "BEGIN; DELETE FROM auth.users WHERE id='55555555-5555-4555-8555-555555555555'; SELECT pg_sleep(2); COMMIT" >"$KITS_DELETE_TMP/concurrent" 2>&1 &
KITS_PID=$!;sleep 0.3
if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO storage.objects(owner_id) VALUES ('55555555-5555-4555-8555-555555555555')" >"$KITS_DELETE_TMP/storage-error" 2>&1; then printf '%s\n' 'Unexpected concurrent Storage insert' >&2;exit 1;fi
wait "$KITS_PID"
# The FK-free columns must wait and reject a newly deleted ID.
KITS_ID=200
for pair in attempts:owner_id ownership_evidence:user_id request_limits:user_id connections:approved_by ownership_evidence:recorded_by ownership_evidence:revoked_by; do
 for schema in kitsnode_ads_private kitsnode_ads_test_20261117; do
 relation=${pair%:*}; owner_column=${pair#*:}
 user=$(printf '66666666-6666-4666-8666-%012d' "$KITS_ID"); KITS_ID=$((KITS_ID+1))
 "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users VALUES ('$user')" >/dev/null
 "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "BEGIN; DELETE FROM auth.users WHERE id='$user'; SELECT pg_sleep(1); COMMIT" >"$KITS_DELETE_TMP/concurrent" 2>&1 &
 KITS_PID=$!;sleep 0.2
 if "$PSQL" -h "$KITS_DELETE_TMP" -p 55446 -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO $schema.$relation($owner_column) VALUES ('$user')" >"$KITS_DELETE_TMP/ad-error" 2>&1; then printf '%s\n' 'Unexpected concurrent ad-owner insert' >&2;exit 1;fi
 wait "$KITS_PID"
 done
done
printf '%s\n' 'Synthetic Auth admin transaction, audit rollback and shared data guard passed.'
