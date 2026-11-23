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
 if docker logs "$DB" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up' && docker exec "$DB" pg_isready -h db -p 5432 -U supabase_admin -d postgres >/dev/null 2>&1 && docker exec -e PGPASSWORD=local-only-password "$DB" psql -h db -p 5432 -U supabase_admin -d postgres -Atqc 'select 1' 2>/dev/null | grep -qx 1; then ready=1; break; fi
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
# Set up only the minimal tables needed by the existing consent trigger and isolated candidate.
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
-- The stock local image has orphaned graphql watchers; production has none.
do $$begin
 if exists(select 1 from pg_event_trigger where evtname='graphql_watch_drop') then alter event trigger graphql_watch_drop disable; end if;
 if exists(select 1 from pg_event_trigger where evtname='graphql_watch_ddl') then alter event trigger graphql_watch_ddl disable; end if;
end$$;
create schema if not exists kitsnode_member_private;
create table public.kitsnode_member_consents(user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(),primary key(user_id,terms_version,privacy_version));
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key,request_id uuid not null unique,created_at timestamptz not null default now());
SQL
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/migrations/20261116160717_member_signup_consent.sql" >/dev/null
signup() {
 email="$1"
 body=$(jq -cn --arg email "$email" '{email:$email,password:"SyntheticOnly-123456!",data:{kitsnode_consent:{termsVersion:"2026-11-14",privacyVersion:"2026-11-14-naver",termsAccepted:true,privacyAcknowledged:true}}}')
 docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -d "$body" http://auth:9999/signup
}
first=$(signup 'first-member@example.test')
id1=$(printf '%s' "$first" | jq -er '.id')
printf '%s' "$first" | jq -e '.email_confirmed_at == null and .access_token == null' >/dev/null
# The trigger must have recorded the required current consent on Auth creation.
consent=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from public.kitsnode_member_consents where user_id='$id1'")
[ "$consent" = 1 ] || { echo 'Signup consent trigger failed' >&2; exit 1; }
# Read a confirmation URL from the fake SMTP sink; it is never printed or sent outside the internal network.
url=''
for i in $(seq 1 20); do
 docker cp "$DB:/tmp/kits-mailbox" "$TMP/mailbox" 2>/dev/null || :
 if [ -f "$TMP/mailbox" ]; then
  url=$(python3 - "$TMP/mailbox" <<'PY'
import email, html, re, sys
from email import policy
with open(sys.argv[1], 'rb') as f:
    msg = email.message_from_binary_file(f, policy=policy.default)
for part in msg.walk():
    if part.is_multipart():
        continue
    try:
        content = part.get_content()
        if not isinstance(content, str):
            content = content.decode('utf-8', 'replace')
    except Exception:
        continue
    match = re.search(r'http://auth:9999/verify\?[^\s\x22\x27<>]+', html.unescape(content))
    if match:
        print(match.group(0))
        break
PY
  )
 fi
 [ -n "$url" ] && break
 sleep 1
done
[ -n "$url" ] || { echo 'Confirmation link missing from local SMTP' >&2; exit 1; }
status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' "$url")
case "$status" in 2*|3*) ;; *) echo "Confirmation returned HTTP $status" >&2;exit 1;; esac
login=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -d '{"email":"first-member@example.test","password":"SyntheticOnly-123456!"}' 'http://auth:9999/token?grant_type=password')
token=$(printf '%s' "$login" | jq -er '.access_token')
[ "$(docker exec "$DB" curl -fsS -H "Authorization: Bearer $token" http://auth:9999/user | jq -r '.id')" = "$id1" ]
# Test-only DB state: central active documents and atomic consent candidate.
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261121180523_minimal_email_member_profile.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role profile_test_authenticator noinherit login password 'local-postgrest-only-password';
grant anon,authenticated,service_role to profile_test_authenticator;
grant select on public.kitsnode_member_consents to service_role,authenticated;
alter table public.kitsnode_member_consents enable row level security;
create policy consent_read_owner on public.kitsnode_member_consents for select to authenticated using ((select auth.uid())=user_id);
SQL
docker run -d --name "$PGRST" --network "$NET" --network-alias api -e PGRST_DB_URI='postgres://profile_test_authenticator:local-postgrest-only-password@db:5432/postgres' -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters public.ecr.aws/supabase/postgrest:v16.5 >/dev/null
ready=0
for i in $(seq 1 40); do if docker exec "$DB" curl -sS -o /dev/null http://api:3000/ >/dev/null 2>&1; then ready=1;break;fi; sleep 1;done
[ "$ready" = 1 ] || { echo 'PostgREST readiness timed out' >&2;exit 1; }
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261121180546_username_login_service.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261123013537_username_server_managed_limits.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261121180831_prepare_new_email_profile.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261121180849_member_profile_withdraw_verify.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261121181202_hold_member_profile_rpc_until_release.sql" >/dev/null
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from pg_trigger where tgname='kitsnode_email_profile_required'")" = 0 ] || { echo 'Profile trigger unexpectedly exists' >&2;exit 1; }
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261123011803_email_signup_cutoff_gate.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$ROOT/supabase/migrations/20261123014656_enable_email_profile_completion.sql" >/dev/null
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'update kitsnode_member_private.email_profile_gate set required_since=clock_timestamp()' >/dev/null

[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_email_profile_pending_for_service('$id1')")" = f ] || { echo 'Existing member unexpectedly gated' >&2;exit 1; }
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "insert into auth.users(id,raw_app_meta_data) values('00000000-0000-4000-8000-000000000099','{\"provider\":\"custom:naver\"}'::jsonb)" >/dev/null
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000099')")" = f ] || { echo 'Naver-only account unexpectedly gated' >&2;exit 1; }

docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$begin
 if has_function_privilege('anon','public.kitsnode_lookup_email_login(text)','execute') or has_function_privilege('authenticated','public.kitsnode_lookup_email_login(text)','execute') then raise exception 'lookup privilege'; end if;
 if not has_function_privilege('service_role','public.kitsnode_lookup_email_login(text)','execute') then raise exception 'service lookup missing'; end if;
end$$;
SQL
body='{"p_username":"seller_one","p_name":"Synthetic","p_phone":"010-1234-5678","p_age_confirmed":true}'
post(){ docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $1" -d "$body" http://api:3000/rpc/kitsnode_complete_email_profile | jq -r .; }
[ "$(post "$token")" = created ] || { echo 'Profile creation failed' >&2;exit 1; }
[ "$(post "$token")" = already_registered ] || { echo 'Same profile retry failed' >&2;exit 1; }
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from public.kitsnode_email_profiles where user_id='$id1' and username='seller_one'")" = 1 ] || { echo 'Profile absent' >&2;exit 1; }
docker exec "$DB" rm -f /tmp/kits-mailbox
second=$(signup 'second-member@example.test')
id2=$(printf '%s' "$second" | jq -er '.id')
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_email_profile_pending_for_service('$id2')")" = t ] || { echo 'New member not gated' >&2;exit 1; }
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values('synthetic-naver','$id2',jsonb_build_object('sub','synthetic-naver'),'custom:naver',now(),now())" >/dev/null
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_email_profile_pending_for_service('$id2')")" = t ] || { echo 'Linked account gate unexpectedly cleared' >&2;exit 1; }

url2=''
for i in $(seq 1 20); do
 docker cp "$DB:/tmp/kits-mailbox" "$TMP/mailbox2" 2>/dev/null || :
 if [ -f "$TMP/mailbox2" ]; then
  url2=$(python3 - "$TMP/mailbox2" <<'PYMAIL'
import email,html,re,sys
from email import policy
with open(sys.argv[1],'rb') as f: msg=email.message_from_binary_file(f,policy=policy.default)
for part in msg.walk():
 if part.is_multipart(): continue
 try:
  content=part.get_content()
  if not isinstance(content,str): content=content.decode('utf-8','replace')
 except Exception: continue
 match=re.search(r'http://auth:9999/verify\?[^\s\x22\x27<>]+',html.unescape(content))
 if match: print(match.group(0));break
PYMAIL
  )
 fi
 [ -n "$url2" ] && break
 sleep 1
done
[ -n "$url2" ] || { echo 'Second confirmation link missing' >&2;exit 1; }
docker exec "$DB" curl -fsS -o /dev/null "$url2"
second_login=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -d '{"email":"second-member@example.test","password":"SyntheticOnly-123456!"}' 'http://auth:9999/token?grant_type=password')
token2=$(printf '%s' "$second_login" | jq -er '.access_token')
[ "$(post "$token2")" = username_taken ] || { echo 'Duplicate ID unexpectedly accepted' >&2;exit 1; }
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$TMP/gate-key.pem" -out "$TMP/gate-cert.pem" -days 1 -subj '/CN=localhost' >/dev/null 2>&1
KITS_TEST_DB="$DB" KITS_TEST_TOKEN="$token" KITS_TEST_TOKEN2="$token2" KITS_TLS_KEY="$TMP/gate-key.pem" KITS_TLS_CERT="$TMP/gate-cert.pem" KITS_EXPECT_PENDING_STATUS=403 node "$ROOT/tests/minimal-ad-gate-local.mjs"
body='{"p_username":"seller_two","p_name":"Synthetic","p_phone":"010-1234-5678","p_age_confirmed":true}'
[ "$(post "$token2")" = created ] || { echo 'New member completion failed' >&2;exit 1; }
KITS_TEST_DB="$DB" KITS_TEST_TOKEN="$token" KITS_TEST_TOKEN2="$token2" KITS_TLS_KEY="$TMP/gate-key.pem" KITS_TLS_CERT="$TMP/gate-cert.pem" KITS_EXPECT_PENDING_STATUS=200 node "$ROOT/tests/minimal-ad-gate-local.mjs"
body='{"p_username":"seller_one","p_name":"Synthetic","p_phone":"010-1234-5678","p_age_confirmed":true}'

[ "$(docker exec "$DB" curl -fsS -H "Authorization: Bearer $token2" "http://api:3000/kitsnode_email_profiles?user_id=eq.$id1" | jq 'length')" = 0 ] || { echo 'Other member profile exposed' >&2;exit 1; }
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from public.kitsnode_email_profiles where user_id='$id2' and username='seller_two'")" = 1 ] || { echo 'Completed profile absent' >&2;exit 1; }
# Profile completion acquires a shared lock on consent. A concurrent DELETE
# must wait until the profile transaction commits; the reverse order below
# must return consent_required.
claims=$(printf '%s' "$token2" | python3 -c 'import sys,base64; s=sys.stdin.read().strip().split(".")[1]; print(base64.urlsafe_b64decode(s+"="*((-len(s))%4)).decode())')
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atq -c "begin; select set_config('request.jwt.claims', '$claims', true); select public.kitsnode_complete_email_profile('seller_two','Synthetic','01012345678',true); select pg_sleep(3) /* profile_lock_marker */; commit;" >"$TMP/profile-race" 2>/dev/null &
profile_pid=$!
lock_ready=0
for i in $(seq 1 30); do
 if [ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atq -c "select count(*) from pg_stat_activity where query like '%profile_lock_marker%' and state='active' and wait_event='PgSleep' and pid<>pg_backend_pid()")" = 1 ]; then lock_ready=1;break;fi
 sleep 1
done
[ "$lock_ready" = 1 ] || { echo 'Profile concurrency setup timed out' >&2;exit 1; }
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "delete from public.kitsnode_member_consents where user_id='$id2'" >/dev/null
wait "$profile_pid"
grep -qx already_registered "$TMP/profile-race" || { echo 'Concurrent profile completion failed' >&2;exit 1; }
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_email_profile_pending_for_service('$id2')")" = f ] || { echo 'Profile gate did not clear' >&2;exit 1; }
body='{"p_username":"seller_two","p_name":"Synthetic","p_phone":"010-1234-5678","p_age_confirmed":true}'
[ "$(post "$token2")" = consent_required ] || { echo 'Withdrawn consent accepted' >&2;exit 1; }
body='{"p_username":"seller_one","p_name":"Synthetic","p_phone":"010-1234-5678","p_age_confirmed":true}'
KITS_TEST_DB="$DB" node "$ROOT/tests/minimal-username-login-local.mjs"
KITS_TEST_DB="$DB" node "$ROOT/tests/minimal-username-deno-local.mjs"
KITS_TEST_DB="$DB" node "$ROOT/tests/minimal-full-signup-browser-local.mjs"
KITS_TEST_DB="$DB" KITS_TLS_KEY="$TMP/gate-key.pem" KITS_TLS_CERT="$TMP/gate-cert.pem" node "$ROOT/tests/minimal-auth-prep-full-browser-local.mjs"
status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$body" http://api:3000/rpc/kitsnode_complete_email_profile)
case "$status" in 401|403|404) ;; *) echo 'Anonymous profile endpoint unexpectedly callable' >&2;exit 1;; esac
docker exec "$DB" curl -fsS -o /dev/null -X POST -H "Authorization: Bearer $token" 'http://auth:9999/logout?scope=local'
[ "$(post "$token")" = verification_required ] || { echo 'Revoked session accepted' >&2;exit 1; }
request_id='00000000-0000-4000-8000-000000000098'
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "insert into kitsnode_member_private.deletion_access_blocks(subject_id,request_id) values('$id1','$request_id')" >/dev/null
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_verify_member_profile_deleted('$id1','$request_id')")" = data_remaining ] || { echo 'Profile verification failed to detect retained data' >&2;exit 1; }
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select has_function_privilege('authenticated','public.kitsnode_verify_member_profile_deleted(uuid,uuid)','execute')")" = f ] || { echo 'Profile verification exposed to users' >&2;exit 1; }
docker exec "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "delete from auth.users where id='$id1'" >/dev/null
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from public.kitsnode_email_profiles where user_id='$id1'")" = 0 ] || { echo 'Profile cascade failed' >&2;exit 1; }
[ "$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select public.kitsnode_verify_member_profile_deleted('$id1','$request_id')")" = cleaned ] || { echo 'Profile deletion verification failed' >&2;exit 1; }
echo 'Local Auth email verification → PostgREST → minimal profile and revoked session checks passed.'
FAILED=0
