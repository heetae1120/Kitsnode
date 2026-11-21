#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
d=$(mktemp -d "${TMPDIR:-/tmp}/kits-consent.XXXXXXXX")
started=0
cleanup(){ if [ "$started" = 1 ]; then pg_ctl -D "$d/data" stop -m fast >/dev/null 2>&1 || true; fi; rm -rf "$d"; }
trap cleanup EXIT INT TERM
initdb -D "$d/data" -A trust --no-instructions >"$d/init.log"
pg_ctl -D "$d/data" -o "-p 56413 -k $d -c listen_addresses=" -l "$d/server.log" start >/dev/null
started=1
psql -X -h "$d" -p 56413 -d postgres -v ON_ERROR_STOP=1 -f "$root/tests/sql/invite-consent-candidate.sql"
python3 - "$d" <<'PYCODE'
import concurrent.futures, subprocess,sys
socket=sys.argv[1]
def run(sql):
 return subprocess.run(['psql','-X','-qAt','-h',socket,'-p','56413','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],capture_output=True,text=True,check=True).stdout.strip()
u="'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"; sid="'11111111-1111-4111-8111-111111111111'"; c="'dddddddd-dddd-4ddd-8ddd-dddddddddddd'"; rid="'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'"
args=f"{c},{u},{sid},'123','v1',repeat('a',64)"
run(f"set role service_role; select kitsnode_ads_private.record_invite_consent_candidate({args});")
q=f"set role service_role; select kitsnode_ads_private.reserve_invite_consent_candidate({args},{rid});"
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(run,[q]*12))
if results.count('t')!=1 or results.count('f')!=11: raise SystemExit('concurrent reserve was not one-shot')
# Race begin and release: exactly one wins; if begin wins no retry is possible.
begin=f"set role service_role; select kitsnode_ads_private.begin_invite_send_candidate({args},{rid});"
release=f"set role service_role; select kitsnode_ads_private.release_invite_consent_candidate({args},{rid});"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: result=list(pool.map(run,[begin,release]))
if sorted(result)!=['f','t']: raise SystemExit('begin/release race was not atomic')
print('concurrent consent: one reservation and one begin/release race winner')
PYCODE
