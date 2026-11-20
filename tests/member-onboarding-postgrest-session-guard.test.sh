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
# Dedicated test-only exposed schema; the real private schema remains unexposed.
# Do not deploy this wrapper or treat it as an approved production API.
docker exec -i "$DB" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role test_onboarding_authenticator noinherit login password 'local-postgrest-only-password';
grant anon,authenticated to test_onboarding_authenticator;
create schema onboarding_test_api;
grant usage on schema onboarding_test_api to anon,authenticated;
create function onboarding_test_api.complete_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean,p_expected_email text)
returns text language sql security invoker set search_path='' as $$
  select kitsnode_member_private.complete_email_profile_session_candidate(p_username,p_name,p_phone,p_age_confirmed,p_expected_email);
$$;
revoke all on function onboarding_test_api.complete_profile(text,text,text,boolean,text) from public,anon,authenticated;
grant execute on function onboarding_test_api.complete_profile(text,text,text,boolean,text) to authenticated;
SQL
docker run -d --name "$PGRST" --network "$NET" --network-alias api \
 -e PGRST_DB_URI='postgres://test_onboarding_authenticator:local-postgrest-only-password@db:5432/postgres' \
 -e PGRST_DB_SCHEMAS=onboarding_test_api -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters \
 public.ecr.aws/supabase/postgrest:v16.5 >/dev/null
ready=0
for i in $(seq 1 40); do
 if docker exec "$DB" curl -sS -o /dev/null http://api:3000/ >/dev/null 2>&1; then ready=1; break; fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$PGRST")" != true ]; then echo 'PostgREST exited during startup' >&2; exit 1; fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'PostgREST readiness timed out' >&2; exit 1; }
body='{"p_username":"Seller_one","p_name":"홍길동","p_phone":"010-1234-5678","p_age_confirmed":true,"p_expected_email":"first-member@example.test"}'
# Unauthenticated and tampered tokens must not execute the protected operation.
anon_status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$body" http://api:3000/rpc/complete_profile)
case "$anon_status" in 401|403|404) ;; *) echo "Unexpected unauthenticated status: $anon_status" >&2; exit 1;; esac
tampered_status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer invalid.jwt.token' -d "$body" http://api:3000/rpc/complete_profile)
[ "$tampered_status" = 401 ] || { echo "Unexpected invalid token status: $tampered_status" >&2; exit 1; }
claim_result=$(docker exec "$DB" curl -sS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$body" http://api:3000/rpc/complete_profile)
claim=$(printf %s "$claim_result" | jq -r 'if type == "object" then .code // "unknown" else . end')
if [ "$claim" != created ]; then
 echo "Profile completion result code: $claim" >&2
 printf '%s' "$claim_result" | jq -r '.message // "no message" | gsub("eyJ[A-Za-z0-9._-]+";"[redacted]") | gsub("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+";"[email]")' >&2
 exit 1
fi
owner=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select user_id from kitsnode_member_private.member_signup_profiles_candidate where username='seller_one'")
[ "$owner" = "$id1" ] || { echo 'Profile owner does not match authenticated user' >&2; exit 1; }
# Signed JWT with a caller-supplied subject must not gain another identity.
spoof='{"p_username":"other_user","p_name":"A","p_phone":"010-1234-5678","p_age_confirmed":true,"p_expected_email":"first-member@example.test","subject":"00000000-0000-0000-0000-000000000002"}'
spoof_status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$spoof" http://api:3000/rpc/complete_profile)
case "$spoof_status" in 400|404) ;; *) echo "Unexpected subject spoof status: $spoof_status" >&2; exit 1;; esac
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
# The other authenticated member cannot complete a profile using the first email.
second_wrong='{"p_username":"second_user","p_name":"B","p_phone":"010-1234-5678","p_age_confirmed":true,"p_expected_email":"first-member@example.test"}'
wrong=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token2" -d "$second_wrong" http://api:3000/rpc/complete_profile | jq -r .)
[ "$wrong" = verification_required ] || { echo "Cross-member attempt returned: $wrong" >&2;exit 1; }
# Confirm the real Auth session and JWT fields without printing identifiers.
sid2=$(printf '%s' "$token2" | python3 -c 'import sys,json,base64; p=sys.stdin.read().split(".")[1]; d=json.loads(base64.urlsafe_b64decode(p+"="*(-len(p)%4))); assert isinstance(d.get("exp"),int); print(d["session_id"])')
printf '%s' "$sid2" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || { echo 'JWT lacks expected session id' >&2;exit 1; }
active=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from auth.sessions where id='$sid2' and user_id='$id2'")
[ "$active" = 1 ] || { echo 'Real Auth session row missing' >&2;exit 1; }
columns=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from information_schema.columns where table_schema='auth' and table_name='sessions' and ((column_name in ('id','user_id') and data_type='uuid') or (column_name='not_after' and data_type='timestamp with time zone'))")
[ "$columns" = 3 ] || { echo 'Real Auth session schema differs from candidate assumptions' >&2;exit 1; }
logout_status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $token2" http://auth:9999/logout)
case "$logout_status" in 2*) ;; *) echo "Local Auth logout returned HTTP $logout_status" >&2; exit 1;; esac
remain=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from auth.sessions where id='$sid2' and user_id='$id2'")
[ "$remain" = 0 ] || { echo 'Logged-out session row still present' >&2;exit 1; }
auth_after=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token2" http://auth:9999/user)
case "$auth_after" in 401|403) ;; *) echo "Auth unexpectedly accepts logged-out session: $auth_after" >&2;exit 1;; esac
second_body='{"p_username":"second_user","p_name":"B","p_phone":"010-1234-5678","p_age_confirmed":true,"p_expected_email":"second-member@example.test"}'
after=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token2" -d "$second_body" http://api:3000/rpc/complete_profile | jq -r .)
[ "$after" = unauthenticated ] || { echo "Logged-out session was not rejected: $after" >&2;exit 1; }
no_insert=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='$id2'")
[ "$no_insert" = 0 ] || { echo 'Logged-out user profile was created' >&2;exit 1; }
other=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$body" http://api:3000/rpc/complete_profile | jq -r .)
[ "$other" = already_registered ] || { echo "Other user's active session failed: $other" >&2;exit 1; }
echo 'Real Auth/PostgREST session-guard candidate: active user, identity isolation, signed-out token rejection, no insertion, and unaffected other user passed'
FAILED=0
