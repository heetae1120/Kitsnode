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
# Set up only the minimal tables needed by the existing consent trigger and isolated candidate.
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create schema if not exists kitsnode_member_private;
create table public.kitsnode_member_consents(user_id uuid not null references auth.users(id) on delete cascade,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(),primary key(user_id,terms_version,privacy_version));
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key);
SQL
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/migrations/20261116160717_member_signup_consent.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/review-drafts/member-profile-candidate.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/review-drafts/member-profile-session-guard-candidate.sql" >/dev/null
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
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$ROOT/supabase/review-drafts/member-atomic-completion-candidate.sql" >/dev/null
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into kitsnode_member_private.member_active_documents_candidate values(true,'terms1','privacy1',repeat('a',64),repeat('b',64),1);
-- Isolated proof must revoke both prior completion paths before exposing test wrappers.
revoke execute on function kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text) from authenticated;
revoke execute on function kitsnode_member_private.complete_email_profile_session_candidate(text,text,text,boolean,text) from authenticated;
do $$begin
 if has_function_privilege('authenticated','kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text)','execute') then raise exception 'old unguarded profile callable'; end if;
 if has_function_privilege('authenticated','kitsnode_member_private.complete_email_profile_session_candidate(text,text,text,boolean,text)','execute') then raise exception 'old session profile callable'; end if;
 if has_function_privilege('anon','kitsnode_member_private.complete_email_atomic_candidate(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean)','execute') then raise exception 'anon atomic callable'; end if;
end$$;
create role test_onboarding_authenticator noinherit login password 'local-postgrest-only-password';
grant anon,authenticated to test_onboarding_authenticator;
create schema onboarding_test_api;
grant usage on schema onboarding_test_api to anon,authenticated;
create function onboarding_test_api.complete_profile(p_username text,p_name text,p_phone text,p_expected_email text,p_terms_version text,p_privacy_version text,p_document_revision bigint,p_terms_sha256 text,p_privacy_sha256 text,p_terms_accepted boolean,p_privacy_accepted boolean,p_age_confirmed boolean)
returns text language sql security invoker set search_path='' as $$
 select kitsnode_member_private.complete_email_atomic_candidate(p_username,p_name,p_phone,p_expected_email,p_terms_version,p_privacy_version,p_document_revision,p_terms_sha256,p_privacy_sha256,p_terms_accepted,p_privacy_accepted,p_age_confirmed);
$$;
create function onboarding_test_api.old_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean,p_expected_email text)
returns text language sql security invoker set search_path='' as $$ select kitsnode_member_private.complete_email_profile_candidate(p_username,p_name,p_phone,p_age_confirmed,p_expected_email); $$;
create function onboarding_test_api.old_session_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean,p_expected_email text)
returns text language sql security invoker set search_path='' as $$ select kitsnode_member_private.complete_email_profile_session_candidate(p_username,p_name,p_phone,p_age_confirmed,p_expected_email); $$;
revoke all on function onboarding_test_api.complete_profile(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function onboarding_test_api.old_profile(text,text,text,boolean,text) from public,anon,authenticated;
revoke all on function onboarding_test_api.old_session_profile(text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function onboarding_test_api.complete_profile(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean) to authenticated;
grant execute on function onboarding_test_api.old_profile(text,text,text,boolean,text) to authenticated;
grant execute on function onboarding_test_api.old_session_profile(text,text,text,boolean,text) to authenticated;
SQL
docker run -d --name "$PGRST" --network "$NET" --network-alias api \
 -e PGRST_DB_URI='postgres://test_onboarding_authenticator:local-postgrest-only-password@db:5432/postgres' \
 -e PGRST_DB_SCHEMAS=onboarding_test_api -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters \
 public.ecr.aws/supabase/postgrest:v16.5 >/dev/null
ready=0
for i in $(seq 1 40); do
 if docker exec "$DB" curl -sS -o /dev/null http://api:3000/ >/dev/null 2>&1; then ready=1;break;fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$PGRST")" != true ]; then echo 'PostgREST exited during startup' >&2;exit 1;fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'PostgREST readiness timed out' >&2;exit 1; }
ha=$(printf '%064d' 0 | tr 0 a); hb=$(printf '%064d' 0 | tr 0 b); hc=$(printf '%064d' 0 | tr 0 c)
make_body(){ jq -cn --arg id "$1" --arg mail "$2" --arg th "$3" --arg ph "$hb" '{p_username:$id,p_name:"Synthetic",p_phone:"010-1234-5678",p_expected_email:$mail,p_terms_version:"terms1",p_privacy_version:"privacy1",p_document_revision:1,p_terms_sha256:$th,p_privacy_sha256:$ph,p_terms_accepted:true,p_privacy_accepted:true,p_age_confirmed:true}'; }
body=$(make_body seller_one first-member@example.test "$ha")
stale=$(make_body seller_one first-member@example.test "$hc")
post(){ docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $1" -d "$2" http://api:3000/rpc/complete_profile | jq -r .; }
# A wrong hash must leave no active-document consent, evidence or profile.
[ "$(post "$token" "$stale")" = document_changed ] || { echo 'Wrong hash not rejected' >&2;exit 1; }
counts=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select (select count(*) from public.kitsnode_member_consents where user_id='$id1' and terms_version='terms1') || ':' || (select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='$id1') || ':' || (select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='$id1')")
[ "$counts" = '0:0:0' ] || { echo 'Stale hash left new state' >&2;exit 1; }
# Authenticated callers cannot bypass atomic flow using either previous function.
old='{"p_username":"old_seller","p_name":"Synthetic","p_phone":"010-1234-5678","p_age_confirmed":true,"p_expected_email":"first-member@example.test"}'
for endpoint in old_profile old_session_profile; do
 status_old=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$old" "http://api:3000/rpc/$endpoint")
 case "$status_old" in 401|403) ;; *) echo "Previous RPC unexpectedly callable: $status_old" >&2;exit 1;; esac
done
unauth=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$body" http://api:3000/rpc/complete_profile)
case "$unauth" in 401|403|404) ;; *) echo "Anonymous atomic RPC unexpectedly callable: $unauth" >&2;exit 1;; esac
# Correct central metadata stores all three records as one completion.
[ "$(post "$token" "$body")" = created ] || { echo 'Valid atomic completion failed' >&2;exit 1; }
counts=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select (select count(*) from public.kitsnode_member_consents where user_id='$id1' and terms_version='terms1' and privacy_version='privacy1') || ':' || (select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='$id1' and document_revision=1 and terms_sha256=repeat('a',64) and privacy_sha256=repeat('b',64)) || ':' || (select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='$id1' and username='seller_one')")
[ "$counts" = '1:1:1' ] || { echo 'Atomic completion records missing' >&2;exit 1; }
[ "$(post "$token" "$body")" = already_registered ] || { echo 'Identical retry not idempotent' >&2;exit 1; }
# A second real local Auth account receives its own token via local SMTP.
docker exec "$DB" rm -f /tmp/kits-mailbox
second=$(signup 'second-member@example.test')
id2=$(printf '%s' "$second" | jq -er '.id')
[ "$id1" != "$id2" ] || { echo 'Test Auth subjects unexpectedly equal' >&2; exit 1; }
url2=''
for i in $(seq 1 20); do
 docker cp "$DB:/tmp/kits-mailbox" "$TMP/mailbox2" 2>/dev/null || :
 if [ -f "$TMP/mailbox2" ]; then
  url2=$(python3 - "$TMP/mailbox2" <<'PYMAIL'
import email,html,re,sys
from email import policy
with open(sys.argv[1], 'rb') as f: msg=email.message_from_binary_file(f,policy=policy.default)
for part in msg.walk():
    if part.is_multipart(): continue
    try:
        content=part.get_content()
        if not isinstance(content,str): content=content.decode('utf-8','replace')
    except Exception: continue
    match=re.search(r'http://auth:9999/verify\?[^\s\x22\x27<>]+',html.unescape(content))
    if match:
        print(match.group(0));break
PYMAIL
  )
 fi
 [ -n "$url2" ] && break
 sleep 1
done
[ -n "$url2" ] || { echo 'Second local confirmation link missing' >&2;exit 1; }
status2=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' "$url2")
case "$status2" in 2*|3*) ;; *) echo "Second local confirmation returned HTTP $status2" >&2;exit 1;; esac
login2=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -d '{"email":"second-member@example.test","password":"SyntheticOnly-123456!"}' 'http://auth:9999/token?grant_type=password')
token2=$(printf '%s' "$login2" | jq -er '.access_token')
[ "$(docker exec "$DB" curl -fsS -H "Authorization: Bearer $token2" http://auth:9999/user | jq -r '.id')" = "$id2" ] || { echo 'Second session identity mismatch' >&2;exit 1; }
# B cannot claim A's username; no active-document consent/evidence may remain.
body2=$(make_body seller_one second-member@example.test "$ha")
[ "$(post "$token2" "$body2")" = username_taken ] || { echo 'Duplicate username not rejected' >&2;exit 1; }
counts=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select (select count(*) from public.kitsnode_member_consents where user_id='$id2' and terms_version='terms1') || ':' || (select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='$id2') || ':' || (select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='$id2')")
[ "$counts" = '0:0:0' ] || { echo 'Duplicate username left partial records' >&2;exit 1; }
logout_status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $token2" http://auth:9999/logout)
case "$logout_status" in 2*) ;; *) echo "Local Auth logout returned HTTP $logout_status" >&2;exit 1;; esac
body2=$(make_body seller_two second-member@example.test "$ha")
[ "$(post "$token2" "$body2")" = unauthenticated ] || { echo 'Logged-out atomic completion not rejected' >&2;exit 1; }
counts=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select (select count(*) from public.kitsnode_member_consents where user_id='$id2' and terms_version='terms1') || ':' || (select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='$id2') || ':' || (select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='$id2')")
[ "$counts" = '0:0:0' ] || { echo 'Signed-out completion left new records' >&2;exit 1; }
[ "$(post "$token" "$body")" = already_registered ] || { echo 'Other active user failed after logout' >&2;exit 1; }
echo 'Actual Auth JWT + test-only PostgREST: atomic consent/evidence/profile, stale hash, duplicate username, revoked session and old-path denial passed'
FAILED=0
