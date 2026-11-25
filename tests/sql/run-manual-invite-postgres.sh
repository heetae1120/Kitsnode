#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
d=$(mktemp -d "${TMPDIR:-/tmp}/kits-manual-invite.XXXXXXXX")
started=0
cleanup(){ if [ "$started" = 1 ]; then pg_ctl -D "$d/data" stop -m fast >/dev/null 2>&1 || true; fi; rm -rf "$d"; }
trap cleanup EXIT INT TERM
initdb -D "$d/data" -A trust --no-instructions >"$d/init.log"
pg_ctl -D "$d/data" -o "-p 56471 -k $d -c listen_addresses=" -l "$d/server.log" start >/dev/null
started=1
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 <<'SQL'
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,banned_until timestamptz); create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz);
create schema kitsnode_member_private; create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key); create function kitsnode_member_private.email_profile_is_pending(uuid) returns boolean language sql as 'select false';
create table public.kitsnode_member_consents(user_id uuid not null,terms_version text not null,privacy_version text not null,accepted_at timestamptz);
create schema kitsnode_ads_private; grant usage on schema kitsnode_ads_private to service_role;
create table kitsnode_ads_private.connections(id uuid primary key,user_id uuid not null references auth.users(id),ad_account_id text not null,status text not null default 'pending_review',created_at timestamptz not null default now());
create unique index connection_pending on kitsnode_ads_private.connections(user_id,ad_account_id) where status='pending_review';
create unique index connection_connected on kitsnode_ads_private.connections(ad_account_id) where status='read_connected';
grant select,insert,update,delete on kitsnode_ads_private.connections to service_role;
insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.kitsnode_member_consents values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-23','2026-11-23',now()),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-11-23','2026-11-23',now());
insert into auth.sessions values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null);
SQL
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20261125073836_manual_advertiser_invite_request.sql"
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if has_function_privilege('anon','public.kits_manual_invite_create(uuid,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.kits_manual_invite_attach(uuid,uuid,uuid,uuid,text)','EXECUTE') or not has_function_privilege('service_role','public.kits_manual_invite_create(uuid,uuid,uuid)','EXECUTE') then raise exception 'bad grants'; end if;
end $$;
set role service_role;
select public.kits_manual_invite_create('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
select public.kits_manual_invite_create('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
reset role;
do $$ begin
 if (select count(*) from kitsnode_ads_private.manual_invite_requests)<>1 then raise exception 'duplicate'; end if;
 if public.kits_manual_invite_attach('33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','12345') is null then raise exception 'attach failed'; end if;
 if public.kits_manual_invite_attach('33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','77777') is not null then raise exception 'second attach'; end if;
 if public.kits_manual_invite_create('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111')<>'matched' then raise exception 'matched retry'; end if;
 if (select count(*) from kitsnode_ads_private.connections)<>1 then raise exception 'duplicate connection'; end if;
end $$;
delete from auth.sessions where id='11111111-1111-4111-8111-111111111111';
do $$ begin
 if public.kits_manual_invite_create('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111') is not null then raise exception 'logged out accepted'; end if;
end $$;
SQL
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 <<'SQL'
-- Completion allows the same customer to request a second account.
update kitsnode_ads_private.connections set status='read_connected' where ad_account_id='12345';
insert into auth.sessions values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
do $$ begin
 if public.kits_manual_invite_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')<>'none' then raise exception 'completed status'; end if;
 if public.kits_manual_invite_create('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111')<>'pending_review' then raise exception 'second request'; end if;
 if public.kits_manual_invite_create('77777777-7777-4777-8777-777777777777','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222')<>'pending_review' then raise exception 'other customer request'; end if;
 if public.kits_manual_invite_attach('77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','12345') is not null then raise exception 'other customer already connected'; end if;
end $$;
update public.kitsnode_member_consents set accepted_at=null where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ begin
 if public.kits_manual_invite_create('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111') is not null then raise exception 'consent revoked create'; end if;
 if public.kits_manual_invite_attach('44444444-4444-4444-8444-444444444444','aaaaaaaa-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','99999') is not null then raise exception 'consent revoked attach'; end if;
end $$;
update public.kitsnode_member_consents set accepted_at=now() where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update auth.users set banned_until=now()+interval '1 hour' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$ begin if public.kits_manual_invite_create('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111') is not null then raise exception 'banned create'; end if; end $$;
update auth.users set banned_until=null where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into kitsnode_member_private.deletion_access_blocks values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
do $$ begin if public.kits_manual_invite_attach('44444444-4444-4444-8444-444444444444','aaaaaaaa-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','99999') is not null then raise exception 'withdraw pending attach'; end if; end $$;
delete from kitsnode_member_private.deletion_access_blocks where subject_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into auth.users(id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.kitsnode_member_consents values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-11-23','2026-11-23',now());
insert into auth.sessions values ('99999999-9999-4999-8999-999999999999','cccccccc-cccc-4ccc-8ccc-cccccccccccc',null);
SQL
# Two simultaneous requests must converge on one pending row.
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "select public.kits_manual_invite_create('aaaaaaaa-0000-4000-8000-000000000001','cccccccc-cccc-4ccc-8ccc-cccccccccccc','99999999-9999-4999-8999-999999999999')" >"$d/create-a" & p1=$!
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "select public.kits_manual_invite_create('aaaaaaaa-0000-4000-8000-000000000002','cccccccc-cccc-4ccc-8ccc-cccccccccccc','99999999-9999-4999-8999-999999999999')" >"$d/create-b" & p2=$!
wait "$p1"; wait "$p2"
request_id=$(psql -X -At -h "$d" -p 56471 -d postgres -c "select id from kitsnode_ads_private.manual_invite_requests where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and status='pending_review'")
[ -n "$request_id" ]
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "select public.kits_manual_invite_attach('$request_id','bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','98765')" >"$d/attach-a" & p1=$!
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "select public.kits_manual_invite_attach('$request_id','bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','98766')" >"$d/attach-b" & p2=$!
wait "$p1"; wait "$p2"
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from kitsnode_ads_private.manual_invite_requests where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>1 then raise exception 'concurrent creation'; end if;
 if (select count(*) from kitsnode_ads_private.connections where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>1 then raise exception 'concurrent attachment'; end if;
end $$;
-- Customer deletion removes pending request records after existing ad cleanup.
delete from kitsnode_ads_private.connections where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
delete from auth.sessions where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
delete from auth.users where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$ begin if exists(select 1 from kitsnode_ads_private.manual_invite_requests where user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') then raise exception 'orphan request'; end if; end $$;
SQL
# A concurrent consent withdrawal must be observed before request creation.
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "begin; update public.kitsnode_member_consents set accepted_at=null where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; select pg_sleep(1); commit" >"$d/withdraw-consent" & p1=$!
sleep 0.2
result=$(psql -X -At -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "select coalesce(public.kits_manual_invite_create('aaaaaaaa-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),'blocked')")
wait "$p1"
[ "$result" = blocked ]
# A logout that commits before the transaction obtains the session row blocks creation.
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "update public.kitsnode_member_consents set accepted_at=now() where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'"
psql -X -q -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "begin; delete from auth.sessions where id='11111111-1111-4111-8111-111111111111'; select pg_sleep(1); commit" >"$d/logout" & p1=$!
sleep 0.2
result=$(psql -X -At -h "$d" -p 56471 -d postgres -v ON_ERROR_STOP=1 -c "select coalesce(public.kits_manual_invite_create('aaaaaaaa-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),'blocked')")
wait "$p1"
[ "$result" = blocked ]
printf 'manual invite PostgreSQL checks passed\n'
