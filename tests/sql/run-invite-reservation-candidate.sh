#!/bin/sh
set -eu
# Disposable local PostgreSQL only. Does not contact Supabase or Naver.
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/kits-invite-pg.XXXXXXXX")
started=0
cleanup() {
  if [ "$started" = 1 ]; then pg_ctl -D "$test_dir/data" stop -m fast >/dev/null 2>&1 || true; fi
  rm -rf "$test_dir"
}
trap cleanup EXIT INT TERM
initdb -D "$test_dir/data" -A trust --no-instructions >"$test_dir/init.log"
pg_ctl -D "$test_dir/data" -o "-p 56412 -k $test_dir -c listen_addresses=" -l "$test_dir/server.log" start >/dev/null
started=1
psql -X -q -h "$test_dir" -p 56412 -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
SQL
psql -X -q -h "$test_dir" -p 56412 -d postgres -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261117035300_kitsnode_ads_connection_approval_20261117.sql"
psql -X -q -h "$test_dir" -p 56412 -d postgres -v ON_ERROR_STOP=1 -f "$root/keyword-api/test-fixtures/invite-reservation-candidate.sql"
python3 - "$test_dir" <<'PY'
import concurrent.futures, subprocess, sys
sock = sys.argv[1]
def run(sql):
    return subprocess.run(['psql','-X','-qAt','-h',sock,'-p','56412','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql], check=True, capture_output=True, text=True).stdout.strip()

user='11111111-1111-4111-8111-111111111111'
other='22222222-2222-4222-8222-222222222222'
rid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
run(f"insert into auth.users values ('{user}'),('{other}'); insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values ('{rid}','{user}','123');")
run("set role authenticated; do $$ begin begin perform public.kits_ads_invite_job('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); raise exception 'unauthorized access'; exception when insufficient_privilege then null; end; end $$;")
assert run(f"set role service_role; select public.kits_ads_invite_consent('{rid}','{other}','kits','OPERATIONS_MANAGER');") == 'f'
assert run(f"set role service_role; select public.kits_ads_invite_consent('{rid}','{user}','kits','OPERATIONS_MANAGER');") == 't'
assert run(f"set role service_role; select public.kits_ads_invite_reserve('{rid}','{user}','123','0:0','other','OPERATIONS_MANAGER');") == 'f'
reserve=f"set role service_role; select public.kits_ads_invite_reserve('{rid}','{user}','123','0:0','kits','OPERATIONS_MANAGER');"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results=list(pool.map(run,[reserve]*8))
assert results.count('t') == 1 and results.count('f') == 7, results
assert run(f"set role service_role; select public.kits_ads_invite_revoke('{rid}','{user}');") == 't'
assert run(f"set role service_role; select consent::text||':'||revision from public.kits_ads_invite_job('{rid}');") == 'false:0:1'
assert run(reserve) == 'f'
assert run(f"set role service_role; select public.kits_ads_invite_finish('{rid}','uncertain');") == 't'
assert run(f"set role service_role; select public.kits_ads_invite_finish('{rid}','pending_review');") == 'f'
print('isolated PostgreSQL: access denied, exact consent binding, one concurrent reservation, revocation and terminal result verified')
PY
node "$root/keyword-api/test-fixtures/invite-service-postgres-check.mjs" "$test_dir" 56412
node "$root/keyword-api/test-fixtures/invite-reservation-adapter-postgres.mjs" "$test_dir" 56412
