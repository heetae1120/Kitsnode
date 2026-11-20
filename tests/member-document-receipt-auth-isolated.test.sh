#!/bin/sh
# Isolated Supabase Auth + PostgreSQL + fake SMTP. No hosted services or external email.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
KITS_TEST="kits-auth-member-$$-$(date +%s)"
NET="$KITS_TEST-net"; DB="$KITS_TEST-db"; AUTH="$KITS_TEST-auth"; PGRST="$KITS_TEST-postgrest"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/kits-auth-member.XXXXXX")
FAILED=1
cleanup() {
 if [ "$FAILED" = 1 ]; then
  echo 'Isolated test failed; service logs are withheld because they may contain email verification tokens.' >&2
 fi
 docker rm -f "$PGRST" "$AUTH" "$DB" >/dev/null 2>&1 || :
 docker network rm "$NET" >/dev/null 2>&1 || :
 rm -rf "$TMP"
}
trap cleanup EXIT HUP INT TERM
cat > "$TMP/smtp.sh" <<'SMTP'
#!/bin/sh
printf '220 local-smtp ESMTP\r\n'
in_data=0
while IFS= read -r line; do
 line=$(printf '%s' "$line" | tr -d '\r')
 if [ "$in_data" = 1 ]; then
  if [ "$line" = . ]; then in_data=0; printf '250 queued\r\n'; else printf '%s\n' "$line" >>/tmp/kits-mailbox; fi
  continue
 fi
 case "$line" in
  EHLO*|HELO*) printf '250 local-smtp\r\n';;
  MAIL\ FROM:*|RCPT\ TO:*|RSET*) printf '250 ok\r\n';;
  DATA*) in_data=1; printf '354 send\r\n';;
  QUIT*) printf '221 bye\r\n'; break;;
  *) printf '250 ok\r\n';;
 esac
done
SMTP
chmod 755 "$TMP/smtp.sh"
for image in public.ecr.aws/supabase/gotrue:v2.198.0 public.ecr.aws/supabase/postgres:17.12.0.000 public.ecr.aws/supabase/postgrest:v16.5; do docker image inspect "$image" >/dev/null; done
docker network create --internal "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" --network-alias db --memory 768m \
 -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres \
 public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql -c listen_addresses='*' >/dev/null
ready=0
for i in $(seq 1 90); do
 if docker exec "$DB" pg_isready -h db -p 5432 -U supabase_admin -d postgres >/dev/null 2>&1 && docker exec -e PGPASSWORD=local-only-password "$DB" psql -h db -p 5432 -U supabase_admin -d postgres -Atqc 'select 1' 2>/dev/null | grep -qx 1; then ready=1; break; fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$DB")" != true ]; then echo 'Database exited during startup' >&2; exit 1; fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'Database TCP readiness timed out' >&2; exit 1; }
docker cp "$TMP/smtp.sh" "$DB:/tmp/kits-smtp.sh"
docker exec -d "$DB" sh -c 'exec nc -lk -p 2525 -e /tmp/kits-smtp.sh'
docker run -d --name "$AUTH" --network "$NET" --network-alias auth \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://auth:9999 \
 -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL='postgres://supabase_admin:local-only-password@db:5432/postgres?sslmode=disable' \
 -e GOTRUE_SITE_URL=http://localhost -e GOTRUE_URI_ALLOW_LIST='http://localhost/**' \
 -e GOTRUE_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false \
 -e GOTRUE_SMTP_HOST=db -e GOTRUE_SMTP_PORT=2525 -e GOTRUE_SMTP_ADMIN_EMAIL=local@example.test -e GOTRUE_SMTP_SENDER_NAME=Local \
 public.ecr.aws/supabase/gotrue:v2.198.0 >/dev/null
ready=0
for i in $(seq 1 40); do
 if docker exec "$DB" curl -fsS http://auth:9999/health >/dev/null 2>&1; then ready=1;break;fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$AUTH")" != true ]; then echo 'Auth exited during startup' >&2; exit 1; fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'Auth internal readiness timed out' >&2; exit 1; }
echo 'Internal PostgreSQL and real Supabase Auth ready'
# Load existing consent trigger and isolated review SQL into the disposable DB.
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create schema if not exists kitsnode_member_private;
create table public.kitsnode_member_consents(user_id uuid not null references auth.users(id) on delete cascade,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(),primary key(user_id,terms_version,privacy_version));
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key);
SQL
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/migrations/20261116160717_member_signup_consent.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/review-drafts/member-profile-candidate.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/review-drafts/member-profile-session-guard-candidate.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/review-drafts/member-atomic-completion-candidate.sql" >/dev/null
# Dedicated test-only RPC wrapper; never a production exposed schema.
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role test_sdk_authenticator noinherit login password 'local-postgrest-only-password';
grant anon,authenticated to test_sdk_authenticator;
create schema sdk_test_api;
grant usage on schema sdk_test_api to anon,authenticated;
-- Test-only hardening: no bypass through either earlier private function.
revoke execute on function kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text) from authenticated;
revoke execute on function kitsnode_member_private.complete_email_profile_session_candidate(text,text,text,boolean,text) from authenticated;
create function sdk_test_api.complete_profile(p_username text,p_name text,p_phone text,p_expected_email text,p_terms_version text,p_privacy_version text,p_document_revision bigint,p_terms_sha256 text,p_privacy_sha256 text,p_terms_accepted boolean,p_privacy_accepted boolean,p_age_confirmed boolean)
returns text language sql security invoker set search_path='' as $$
 select kitsnode_member_private.complete_email_atomic_candidate(p_username,p_name,p_phone,p_expected_email,p_terms_version,p_privacy_version,p_document_revision,p_terms_sha256,p_privacy_sha256,p_terms_accepted,p_privacy_accepted,p_age_confirmed);
$$;
create function sdk_test_api.old_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean,p_expected_email text)
returns text language sql security invoker set search_path='' as $$ select kitsnode_member_private.complete_email_profile_candidate(p_username,p_name,p_phone,p_age_confirmed,p_expected_email); $$;
create function sdk_test_api.old_session_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean,p_expected_email text)
returns text language sql security invoker set search_path='' as $$ select kitsnode_member_private.complete_email_profile_session_candidate(p_username,p_name,p_phone,p_age_confirmed,p_expected_email); $$;
revoke all on function sdk_test_api.complete_profile(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function sdk_test_api.old_profile(text,text,text,boolean,text) from public,anon,authenticated;
revoke all on function sdk_test_api.old_session_profile(text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function sdk_test_api.complete_profile(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean) to authenticated;
grant execute on function sdk_test_api.old_profile(text,text,text,boolean,text) to authenticated;
grant execute on function sdk_test_api.old_session_profile(text,text,text,boolean,text) to authenticated;
SQL
docker run -d --name "$PGRST" --network "$NET" --network-alias api \
 -e PGRST_DB_URI='postgres://test_sdk_authenticator:local-postgrest-only-password@db:5432/postgres' \
 -e PGRST_DB_SCHEMAS=sdk_test_api -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters \
 public.ecr.aws/supabase/postgrest:v16.5 >/dev/null
ready=0
for i in $(seq 1 40); do
 if docker exec "$DB" curl -sS -o /dev/null http://api:3000/ >/dev/null 2>&1; then ready=1;break;fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$PGRST")" != true ]; then echo 'PostgREST exited during startup' >&2;exit 1;fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'PostgREST readiness timed out' >&2;exit 1; }
# The local-only SDK fixture talks to GoTrue through docker exec on the
# private test network. It does not call a hosted Supabase project.
node "$ROOT/tests/fixtures/member-document-receipt-auth-isolated.mjs" "$DB"
FAILED=0
