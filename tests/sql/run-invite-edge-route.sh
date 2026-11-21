#!/bin/sh
# Isolated Supabase Edge Runtime smoke test; no production credentials or DB.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
name="kits-invite-edge-route-$$"
port=${KITS_TEST_EDGE_PORT:-49876}
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run -d --name "$name" -p "127.0.0.1:${port}:9000" -v "$root:/src:ro" public.ecr.aws/supabase/edge-runtime:v1.79.1 start --main-service /src/tests/fixtures/invite-edge-route >/dev/null
base="http://127.0.0.1:${port}"
i=0
until curl -sS -o /dev/null "$base/health" 2>/dev/null; do
  i=$((i+1)); [ "$i" -lt 40 ] || { echo 'Edge runtime failed to start' >&2; exit 1; }; sleep 1
done
for prefix in '/functions/v1/kitsnode-ad-consent-proof' '/kitsnode-ad-consent-proof'; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS -H 'Origin: https://heetae1120.github.io' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: authorization,content-type' "$base$prefix/policy-confirm")
  [ "$code" = 204 ] || { echo "policy preflight: $code" >&2; exit 1; }
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Origin: https://heetae1120.github.io' -H 'Content-Type: application/json' --data '{}' "$base$prefix/policy-confirm")
  [ "$code" = 401 ] || { echo "unauthenticated policy POST: $code" >&2; exit 1; }
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS -H 'Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' "$base$prefix/proof/redeem")
  [ "$code" = 204 ] || { echo "proof preflight: $code" >&2; exit 1; }
done
code=$(curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS -H 'Origin: https://heetae1120.github.io' -H 'Access-Control-Request-Method: POST' "$base/wrong/functions/v1/kitsnode-ad-consent-proof/policy-confirm")
[ "$code" = 404 ] || { echo "unexpected path accepted: $code" >&2; exit 1; }
echo 'Edge Runtime public and stripped URL routing passed'
