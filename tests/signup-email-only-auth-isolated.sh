#!/bin/sh
# Real GoTrue and Postgres with a disposable SMTP server and no external network.
set -eu
ID="kits-otp-$$-$(date +%s)"; NET="$ID-net"; DB="$ID-db"; AUTH="$ID-auth"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/kits-otp.XXXXXX")
cleanup(){ docker rm -f "$AUTH" "$DB" >/dev/null 2>&1 || :; docker network rm "$NET" >/dev/null 2>&1 || :; rm -rf "$TMP"; }
trap cleanup EXIT HUP INT TERM
cat >"$TMP/smtp.sh" <<'SMTP'
#!/bin/sh
printf '220 local ESMTP\r\n'
data=0
while IFS= read -r line; do
 line=$(printf '%s' "$line" | tr -d '\r')
 if [ "$data" = 1 ]; then
  if [ "$line" = . ]; then data=0;printf '250 queued\r\n';else printf '%s\n' "$line" >>/tmp/otp-mailbox;fi
  continue
 fi
 case "$line" in EHLO*|HELO*) printf '250 local\r\n';; MAIL\ FROM:*|RCPT\ TO:*|RSET*) printf '250 ok\r\n';; DATA*) data=1;printf '354 send\r\n';; QUIT*) printf '221 bye\r\n';break;; *) printf '250 ok\r\n';; esac
done
SMTP
cat >"$TMP/template.sh" <<'TEMPLATE'
#!/bin/sh
while IFS= read -r line; do [ "$line" = "$(printf '\r')" ] && break; done
body='<p>Verification code: {{ .Token }}</p>'
printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: %s\r\nConnection: close\r\n\r\n%s' "${#body}" "$body"
TEMPLATE
chmod 755 "$TMP/smtp.sh" "$TMP/template.sh"
for image in public.ecr.aws/supabase/gotrue:v2.198.0 public.ecr.aws/supabase/postgres:17.12.0.000;do docker image inspect "$image" >/dev/null;done
docker network create --internal "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" --network-alias db --memory 768m -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql -c listen_addresses='*' >/dev/null
ready=0
for i in $(seq 1 90);do if docker logs "$DB" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up' && docker exec -e PGPASSWORD=local-only-password "$DB" psql -h db -U supabase_admin -d postgres -Atqc 'select 1' 2>/dev/null | grep -qx 1;then ready=1;break;fi;sleep 1;done
[ "$ready" = 1 ] || { echo 'Local database startup failed' >&2;exit 1; }
docker cp "$TMP/smtp.sh" "$DB:/tmp/otp-smtp.sh"
docker cp "$TMP/template.sh" "$DB:/tmp/otp-template.sh"
docker exec -d "$DB" sh -c 'exec nc -lk -p 2525 -e /tmp/otp-smtp.sh'
docker exec -d "$DB" sh -c 'exec nc -lk -p 2526 -e /tmp/otp-template.sh'
docker run -d --name "$AUTH" --network "$NET" --network-alias auth \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://auth:9999 \
 -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL='postgres://supabase_admin:local-only-password@db:5432/postgres?sslmode=disable' \
 -e GOTRUE_SITE_URL=http://localhost -e GOTRUE_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false \
 -e GOTRUE_SMTP_HOST=db -e GOTRUE_SMTP_PORT=2525 -e GOTRUE_SMTP_ADMIN_EMAIL=local@example.test -e GOTRUE_SMTP_SENDER_NAME=Local \
 -e GOTRUE_MAILER_TEMPLATES_CONFIRMATION=http://db:2526/template -e GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=http://db:2526/template public.ecr.aws/supabase/gotrue:v2.198.0 >/dev/null
ready=0
for i in $(seq 1 40);do if docker exec "$DB" curl -fsS http://auth:9999/health >/dev/null 2>&1;then ready=1;break;fi;sleep 1;done
[ "$ready" = 1 ] || { echo 'Local Auth startup failed' >&2;exit 1; }
response=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -d '{"email":"otp-member@example.test","create_user":true}' http://auth:9999/otp)
printf '%s' "$response" | jq -e '.access_token == null' >/dev/null
code=''
for i in $(seq 1 30);do
 docker cp "$DB:/tmp/otp-mailbox" "$TMP/mailbox" 2>/dev/null || :
 if [ -f "$TMP/mailbox" ];then code=$(python3 - "$TMP/mailbox" <<'PY'
import email,re,sys
from email import policy
with open(sys.argv[1],'rb') as f: msg=email.message_from_binary_file(f,policy=policy.default)
for p in msg.walk():
 if p.is_multipart():continue
 value=p.get_content()
 if isinstance(value,bytes):value=value.decode('utf-8','replace')
 match=re.search(r'Verification code:\s*(\d{6})',value)
 if match:print(match.group(1));break
PY
 );fi
 [ -n "$code" ] && break;sleep 1
done
[ -n "$code" ] || { echo 'OTP not found in local SMTP message' >&2;exit 1; }
bad=000000;[ "$code" != "$bad" ] || bad=111111
status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"email\":\"otp-member@example.test\",\"token\":\"$bad\",\"type\":\"email\"}" http://auth:9999/verify)
case "$status" in 4*) ;; *) echo 'Incorrect OTP accepted' >&2;exit 1;; esac
result=$(docker exec "$DB" curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"email\":\"otp-member@example.test\",\"token\":\"$code\",\"type\":\"email\"}" http://auth:9999/verify)
printf '%s' "$result" | jq -e '.access_token != null and .refresh_token != null and .user.email_confirmed_at != null' >/dev/null
status=$(docker exec "$DB" curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"email\":\"otp-member@example.test\",\"token\":\"$code\",\"type\":\"email\"}" http://auth:9999/verify)
case "$status" in 4*) ;; *) echo 'OTP replay accepted' >&2;exit 1;; esac
echo 'Real local Auth: email-only OTP, invalid code, correct code and replay checks passed.'
