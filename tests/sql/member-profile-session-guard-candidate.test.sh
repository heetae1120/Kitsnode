#!/bin/sh
# Isolated PostgreSQL only; mock Auth tables and signed-claim boundary.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
pg_bin=$(pg_config --bindir)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/kits-member-session.XXXXXX")
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
started=0
cleanup() { if [ "$started" = 1 ]; then "$pg_bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null; fi; rm -rf "$tmp"; }
trap cleanup EXIT HUP INT TERM
"$pg_bin/initdb" -D "$tmp/data" -A trust -U postgres --no-locale >/dev/null
"$pg_bin/pg_ctl" -D "$tmp/data" -o "-k $tmp -p $port -c listen_addresses=''" -l "$tmp/log" start >/dev/null
started=1
PSQL="$pg_bin/psql -X -q -v ON_ERROR_STOP=1 -h $tmp -p $port -U postgres -d postgres"
$PSQL <<'SQL'
create role anon; create role authenticated; create schema auth; create schema kitsnode_member_private;
create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
create table public.kitsnode_member_consents(user_id uuid references auth.users(id) on delete cascade,terms_version text,privacy_version text,accepted_at timestamptz);
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key);
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','a@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000002','b@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000003','c@example.test',now(),'{"provider":"email"}');
insert into public.kitsnode_member_consents select id,'2026-11-14','2026-11-14-naver',now() from auth.users;
insert into auth.sessions values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',null),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',now()-interval '1 second'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003',null);
SQL
$PSQL -f "$root/supabase/review-drafts/member-profile-candidate.sql"
$PSQL -f "$root/supabase/review-drafts/member-profile-session-guard-candidate.sql"
$PSQL <<'SQL'
do $$begin
 if has_function_privilege('authenticated','kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text)','execute') then raise exception 'unguarded path still granted'; end if;
 if has_function_privilege('anon','kitsnode_member_private.complete_email_profile_session_candidate(text,text,text,boolean,text)','execute') then raise exception 'anon execute'; end if;
end$$;
set role authenticated;
-- Missing, malformed and foreign sessions and an expired access JWT must fail.
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_profile_session_candidate('seller1','A','01012345678',true,'a@example.test')<>'unauthenticated' then raise exception 'missing session allowed'; end if; end$$;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','session_id','bad','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_profile_session_candidate('seller1','A','01012345678',true,'a@example.test')<>'unauthenticated' then raise exception 'malformed session allowed'; end if; end$$;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','session_id','10000000-0000-0000-0000-000000000003','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_profile_session_candidate('seller1','A','01012345678',true,'a@example.test')<>'unauthenticated' then raise exception 'foreign session allowed'; end if; end$$;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000002','session_id','10000000-0000-0000-0000-000000000002','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_profile_session_candidate('seller2','B','01012345678',true,'b@example.test')<>'unauthenticated' then raise exception 'expired session allowed'; end if; end$$;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','session_id','10000000-0000-0000-0000-000000000001','exp',extract(epoch from now()-interval '1 second')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_profile_session_candidate('seller1','A','01012345678',true,'a@example.test')<>'unauthenticated' then raise exception 'expired JWT allowed'; end if; end$$;
-- Explicit signout deletion invalidates a still unexpired JWT.
reset role;
delete from auth.sessions where id='10000000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000002','session_id','10000000-0000-0000-0000-000000000002','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_profile_session_candidate('seller2','B','01012345678',true,'b@example.test')<>'unauthenticated' then raise exception 'signed-out session allowed'; end if; end$$;
-- A lost response can be retried only with the same normalized profile fields.
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000003','session_id','10000000-0000-0000-0000-000000000003','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin
 if kitsnode_member_private.complete_email_profile_session_candidate('Seller3','C','010-1234-5678',true,'c@example.test')<>'created' then raise exception 'initial profile failed'; end if;
 if kitsnode_member_private.complete_email_profile_session_candidate('seller3','C','01012345678',true,'c@example.test')<>'already_registered' then raise exception 'matching retry failed'; end if;
 if kitsnode_member_private.complete_email_profile_session_candidate('seller3','Other','01012345678',true,'c@example.test')<>'profile_exists' then raise exception 'changed name falsely accepted'; end if;
 if kitsnode_member_private.complete_email_profile_session_candidate('seller3','C','01099998888',true,'c@example.test')<>'profile_exists' then raise exception 'changed phone falsely accepted'; end if;
end$$;
reset role;
do $$begin if not exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate where user_id='00000000-0000-0000-0000-000000000003' and name='C' and phone='01012345678') then raise exception 'retry modified original profile'; end if; end$$;
SQL
# Three independent transactions: profile completes and holds the session row;
# concurrent signout and withdrawal wait, then leave no session/user/profile.
$PSQL -A -t >"$tmp/profile" <<'SQL' &
set statement_timeout='8s'; begin; set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-0000-0000-000000000001','session_id','10000000-0000-0000-0000-000000000001','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,true);
select kitsnode_member_private.complete_email_profile_session_candidate('raceuser','A','01012345678',true,'a@example.test');
select pg_sleep(1); commit;
SQL
profile=$!
sleep 0.2
$PSQL -A -t >"$tmp/logout" <<'SQL' &
set statement_timeout='8s'; begin;
delete from auth.sessions where id='10000000-0000-0000-0000-000000000001';
commit;
SQL
logout=$!
$PSQL -A -t >"$tmp/withdraw" <<'SQL' &
set statement_timeout='8s'; begin;
select pg_advisory_xact_lock(hashtextextended('00000000-0000-0000-0000-000000000001',0));
insert into kitsnode_member_private.deletion_access_blocks values('00000000-0000-0000-0000-000000000001');
delete from auth.users where id='00000000-0000-0000-0000-000000000001';
commit;
SQL
withdraw=$!
wait "$profile"; wait "$logout"; wait "$withdraw"
grep -qx 'created' "$tmp/profile"
$PSQL <<'SQL'
do $$begin
 if exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000001') then raise exception 'withdraw user remains'; end if;
 if exists(select 1 from auth.sessions where id='10000000-0000-0000-0000-000000000001') then raise exception 'session remains'; end if;
 if exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate where user_id='00000000-0000-0000-0000-000000000001') then raise exception 'profile remains'; end if;
end$$;
SQL
printf '%s\n' 'session-guard candidate: isolated PostgreSQL checks passed'
