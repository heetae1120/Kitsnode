#!/bin/sh
# Isolated Supabase Auth + PostgreSQL + fake SMTP. No hosted services or external email.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
KITS_TEST="kits-auth-member-$$-$(date +%s)"
NET="$KITS_TEST-net"; DB="$KITS_TEST-db"; AUTH="$KITS_TEST-auth"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/kits-auth-member.XXXXXX")
FAILED=1
cleanup() {
 if [ "$FAILED" = 1 ]; then
  echo 'Isolated test failed; service logs are withheld because they may contain email verification tokens.' >&2
 fi
 docker rm -f "$AUTH" "$DB" >/dev/null 2>&1 || :
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
for image in public.ecr.aws/supabase/gotrue:v2.198.0 public.ecr.aws/supabase/postgres:17.12.0.000; do docker image inspect "$image" >/dev/null; done
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
 -e GOTRUE_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters -e GOTRUE_JWT_EXP=3600 \
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
# Emulate the validated request's JWT subject at the DB boundary, not a public RPC.
claim=$(docker exec "$DB" psql -U supabase_admin -d postgres -Atqc "set role authenticated; set request.jwt.claim.sub='$id1'; select kitsnode_member_private.complete_email_profile_candidate('Seller_one','홍길동','010-1234-5678',true,'first-member@example.test');")
[ "$claim" = created ] || { echo "Profile completion failed: $claim" >&2; exit 1; }
echo 'Real Auth signup, local SMTP confirmation, password session, consent trigger and profile claim passed'
FAILED=0
