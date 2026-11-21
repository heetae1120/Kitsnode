#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
d=$(mktemp -d "${TMPDIR:-/tmp}/kits-consent-http.XXXXXXXX")
started=0
cleanup(){ if [ "$started" = 1 ]; then pg_ctl -D "$d/data" stop -m fast >/dev/null 2>&1 || true; fi; rm -rf "$d"; }
trap cleanup EXIT INT TERM
initdb -D "$d/data" -A trust --no-instructions >"$d/init.log"
pg_ctl -D "$d/data" -o "-p 56414 -k $d -c listen_addresses=" -l "$d/server.log" start >/dev/null
started=1
psql -X -q -h "$d" -p 56414 -d postgres -v ON_ERROR_STOP=1 -f "$root/tests/sql/invite-consent-candidate.sql" >/dev/null
KITS_CONSENT_PG_SOCKET="$d" KITS_CONSENT_PG_MODULE="${KITS_CONSENT_PG_MODULE:?set node_modules parent with pg installed}" node --test "$root/tests/invite-consent-postgres-integration.test.mjs"
