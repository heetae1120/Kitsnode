#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
d=$(mktemp -d "${TMPDIR:-/tmp}/kits-grant-pg.XXXXXXXX")
started=0
cleanup() { if [ "$started" = 1 ]; then pg_ctl -D "$d/data" stop -m fast >/dev/null 2>&1 || true; fi; rm -rf "$d"; }
trap cleanup EXIT INT TERM
initdb -D "$d/data" -A trust --no-instructions >"$d/init.log"
pg_ctl -D "$d/data" -o "-p 56413 -k $d -c listen_addresses=" -l "$d/server.log" start >/dev/null
started=1
export PGHOST="$d" PGPORT=56413 PGDATABASE=postgres
psql -X -q -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
grant usage on schema auth to service_role; grant select on auth.sessions to service_role;
SQL
psql -X -q -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261117035300_kitsnode_ads_connection_approval_20261117.sql"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/keyword-api/test-fixtures/invite-reservation-candidate.sql"
psql -X -q -v ON_ERROR_STOP=1 -f "$root/keyword-api/test-fixtures/invite-grant-candidate.sql"
python3 - <<'PY'
import subprocess, concurrent.futures
def q(sql):
 p=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql],capture_output=True,text=True)
 if p.returncode: raise RuntimeError(p.stderr)
 return p.stdout.strip()
u='11111111-1111-4111-8111-111111111111';s='22222222-2222-4222-8222-222222222222';r='33333333-3333-4333-8333-333333333333';n='44444444-4444-4444-8444-444444444444';h='a'*64
q(f"insert into auth.users values ('{u}');insert into auth.sessions values ('{s}','{u}',null);insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values ('{r}','{u}','123');")
assert q(f"set role service_role;select public.kits_ads_invite_consent('{r}','{u}','kitsnode','OPERATIONS_MANAGER');")=='t'
assert q(f"set role service_role;select public.kits_invite_grant_issue('{r}','{u}','{s}','{n}','123','advertiser',0,'{h}');")=='t'
assert q(f"set role service_role;select count(*) from public.kits_invite_grant_consume('{h}','{n}','124','advertiser');")=='0'
consume=f"set role service_role;select count(*) from public.kits_invite_grant_consume('{h}','{n}','123','advertiser');"
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as p: results=list(p.map(q,[consume]*6))
assert results.count('1')==1 and results.count('0')==5,results
for i,condition in enumerate(['consent','session','expiry'],start=5):
 rr=f'{i:08d}-3333-4333-8333-333333333333';nn=f'{i:08d}-4444-4444-8444-444444444444';hh=str(i)*64
 q(f"insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values ('{rr}','{u}','{100+i}');")
 assert q(f"set role service_role;select public.kits_ads_invite_consent('{rr}','{u}','kitsnode','OPERATIONS_MANAGER');")=='t'
 assert q(f"set role service_role;select public.kits_invite_grant_issue('{rr}','{u}','{s}','{nn}','{100+i}','advertiser',0,'{hh}');")=='t'
 if condition=='consent': q(f"set role service_role;select public.kits_ads_invite_revoke('{rr}','{u}');")
 if condition=='session': q(f"update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='{s}';")
 if condition=='expiry': q(f"update kitsnode_ads_private.invite_grants set expires_at=clock_timestamp()-interval '1 second' where request_id='{rr}';")
 assert q(f"set role service_role;select count(*) from public.kits_invite_grant_consume('{hh}','{nn}','{100+i}','advertiser');")=='0'
 if condition=='session': q(f"update auth.sessions set not_after=null where id='{s}';")
q("set role authenticated; do $$ begin begin perform public.kits_invite_grant_consume(repeat('a',64),'44444444-4444-4444-8444-444444444444','123','advertiser');raise exception 'unexpected permission';exception when insufficient_privilege then null;end;end $$;")
print('isolated grant DB: exact binding, concurrent one-time consume, revocation, expiry, session and RPC permissions verified')
PY
node "$root/keyword-api/test-fixtures/invite-grant-service-postgres.mjs"
