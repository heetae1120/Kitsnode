#!/bin/sh
set -eu
# Isolated local-only Postgres; never uses a hosted project or user database.
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/kits-ads-pg.XXXXXXXX")
started=0
cleanup() {
  if [ "$started" = 1 ]; then pg_ctl -D "$test_dir/data" stop -m fast >/dev/null 2>&1 || true; fi
  rm -rf "$test_dir"
}
trap cleanup EXIT INT TERM
initdb -D "$test_dir/data" -A trust --no-instructions >"$test_dir/init.log"
pg_ctl -D "$test_dir/data" -o "-p 56411 -k $test_dir -c listen_addresses=" -l "$test_dir/server.log" start >/dev/null
started=1
psql -X -h "$test_dir" -p 56411 -d postgres -v ON_ERROR_STOP=1 -f "$root/tests/sql/kitsnode_ads_connection_bids.sql"
python3 - "$test_dir" <<'PY'
import concurrent.futures, subprocess, sys
socket=sys.argv[1]
def run(sql):
    return subprocess.run(['psql','-X','-qAt','-h',socket,'-p','56411','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],capture_output=True,text=True,check=True).stdout.strip()
run("""insert into auth.users values ('33333333-3333-4333-8333-333333333333');
insert into kitsnode_ads_private.connections(id,user_id,ad_account_id,customer_id,status,naver_role,write_verified,approved_by,evidence_ref)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','33333333-3333-4333-8333-333333333333','555','666','read_connected','MASTER',true,'22222222-2222-4222-8222-222222222222','fixture');
insert into kitsnode_ads_private.rules(id,connection_id,keyword_id,device,position,min_bid,max_bid,max_change,increment,enabled,interval_seconds)
values('ffffffff-ffff-4fff-8fff-ffffffffffff','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','nkw-concurrent','PC',2,100,1000,100,10,true,300);""")
claim="set role service_role; select coalesce(public.kits_ads_claim('ffffffff-ffff-4fff-8fff-ffffffffffff','33333333-3333-4333-8333-333333333333')::text,'null');"
rate="set role service_role; select public.kits_ads_rate_limit('33333333-3333-4333-8333-333333333333');"
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    claims=list(pool.map(run,[claim]*12))
if sum(value!='null' for value in claims)!=1:
    raise SystemExit('concurrent claim failed: expected exactly one winner')
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    rates=list(pool.map(run,[rate]*30))
if rates.count('t')!=20 or rates.count('f')!=10:
    raise SystemExit('concurrent per-user rate limit failed')
print('concurrency: one claim and exactly 20 of 30 rate requests accepted')
run("""insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values('aaaa0000-0000-4000-8000-000000000000','33333333-3333-4333-8333-333333333333','999');
set role service_role;
select public.kits_ads_evidence_record('bbbb0000-0000-4000-8000-000000000000','aaaa0000-0000-4000-8000-000000000000','22222222-2222-4222-8222-222222222222','contract_review','case-race');""")
approve="set role service_role; select public.kits_ads_approve('aaaa0000-0000-4000-8000-000000000000','33333333-3333-4333-8333-333333333333','999',0,'998','MASTER','22222222-2222-4222-8222-222222222222','bbbb0000-0000-4000-8000-000000000000');"
revoke="set role service_role; select public.kits_ads_evidence_revoke('aaaa0000-0000-4000-8000-000000000000','bbbb0000-0000-4000-8000-000000000000','22222222-2222-4222-8222-222222222222');"
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(run,[approve,revoke]))
state=run("select status from kitsnode_ads_private.connections where id='aaaa0000-0000-4000-8000-000000000000';")
if state not in ('pending_review','disconnected'):
    raise SystemExit('revocation race left an approved connection')
print('concurrency: evidence revocation cannot leave connection approved')
PY
