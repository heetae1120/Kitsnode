#!/bin/sh
# Synthetic-only isolated Postgres. Never connects to an external database.
set -eu
KITS_PG_BIN=${KITS_PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
KITS_ROLLBACK_TMP=$(mktemp -d "${TMPDIR:-/tmp}/kits-member-rollback.XXXXXX")
started=0
cleanup(){ if [ "$started" = 1 ]; then "$KITS_PG_BIN/pg_ctl" -D "$KITS_ROLLBACK_TMP/db" -m fast -w stop >/dev/null; fi; rm -rf "$KITS_ROLLBACK_TMP"; }
trap cleanup EXIT HUP INT TERM
"$KITS_PG_BIN/initdb" -D "$KITS_ROLLBACK_TMP/db" --auth-local=trust --auth-host=reject --no-locale >/dev/null
"$KITS_PG_BIN/pg_ctl" -D "$KITS_ROLLBACK_TMP/db" -l "$KITS_ROLLBACK_TMP/log" -o "-k $KITS_ROLLBACK_TMP -p 55447 -c listen_addresses=''" -w start >/dev/null
started=1
PSQL="$KITS_PG_BIN/psql";ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE storage.objects(owner uuid,owner_id text);
CREATE TABLE public.kitsnode_member_consents(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
INSERT INTO auth.users VALUES ('11111111-1111-4111-8111-111111111111');
SQL
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261117035300_kitsnode_ads_connection_approval_20261117.sql" >/dev/null
python3 - "$ROOT" "$KITS_ROLLBACK_TMP" <<'PY'
import sys
source=open(sys.argv[1]+'/supabase/migrations/20261117035300_kitsnode_ads_connection_approval_20261117.sql').read().split('-- All arguments')[0]
open(sys.argv[2]+'/test-schema.sql','w').write(source.replace('kitsnode_ads_private','kitsnode_ads_test_20261117'))
PY
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -f "$KITS_ROLLBACK_TMP/test-schema.sql" >/dev/null
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
SET ROLE service_role;
SELECT public.kits_ads_request('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','12345678');
DO $$ BEGIN IF NOT public.kits_ads_evidence_record('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999','advertiser_confirmation','fixture-case-1') THEN RAISE EXCEPTION 'baseline failed'; END IF; END $$;
RESET ROLE;
SQL
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -f "${KITS_DELETE_MIGRATION:-$ROOT/supabase/functions/kitsnode-member-delete/delete-admin-trigger-no-record-review.sql}" >/dev/null
# Candidate intentionally rejects an unmapped operator, a regression to recover.
if "$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.kits_ads_evidence_record('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999','advertiser_confirmation','fixture-case-2')" >"$KITS_ROLLBACK_TMP/rejected" 2>&1; then printf '%s\n' 'Candidate did not reject unmapped operator' >&2;exit 1;fi
# Schema drift makes rollback fail atomically rather than partially removing guards.
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -c 'DROP TRIGGER kitsnode_guard_ads_limits_candidate ON kitsnode_ads_private.request_limits' >/dev/null
if "$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/supabase/functions/kitsnode-member-delete/delete-admin-trigger-no-record-rollback.sql" >"$KITS_ROLLBACK_TMP/rollback-error" 2>&1; then printf '%s\n' 'Drift rollback unexpectedly succeeded' >&2;exit 1;fi
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='kitsnode_guard_user_delete_candidate' AND NOT tgisinternal) THEN RAISE EXCEPTION 'rollback partially removed guard'; END IF; END $$;
CREATE TRIGGER kitsnode_guard_ads_limits_candidate BEFORE INSERT OR UPDATE OF user_id ON kitsnode_ads_private.request_limits FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('user_id');
SQL
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 -f "$ROOT/supabase/functions/kitsnode-member-delete/delete-admin-trigger-no-record-rollback.sql" >/dev/null
"$PSQL" -h "$KITS_ROLLBACK_TMP" -p 55447 -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
SET ROLE service_role;
DO $$ BEGIN IF NOT public.kits_ads_evidence_record('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999','advertiser_confirmation','fixture-case-2') THEN RAISE EXCEPTION 'advertising did not recover'; END IF; END $$;
RESET ROLE;
INSERT INTO storage.objects(owner_id) VALUES ('99999999-9999-4999-8999-999999999999');
DO $$ BEGIN
 IF (SELECT count(*) FROM kitsnode_ads_private.ownership_evidence)<>2 THEN RAISE EXCEPTION 'existing evidence changed'; END IF;
 IF to_regprocedure('public.kitsnode_delete_member_precheck(uuid)') IS NOT NULL OR to_regclass('kitsnode_member_private.deletion_rate_candidate') IS NOT NULL THEN RAISE EXCEPTION 'rollback incomplete'; END IF;
END $$;
SQL
printf '%s\n' 'Candidate apply, rollback and original ad/Storage behavior verified.'
