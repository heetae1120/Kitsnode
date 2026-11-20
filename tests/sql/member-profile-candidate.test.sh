#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
pg_bin=$(pg_config --bindir)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/kits-member-profile.XXXXXX")
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
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
create table public.kitsnode_member_consents(user_id uuid,terms_version text,privacy_version text,accepted_at timestamptz);
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key);
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','a@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000002','b@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000003','c@example.test',null,'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000004','d@example.test',now(),'{"provider":"naver"}'),
 ('00000000-0000-0000-0000-000000000005','e@example.test',now(),'{"provider":"email"}');
insert into public.kitsnode_member_consents select id,'2026-11-14','2026-11-14-naver',now() from auth.users where id<>'00000000-0000-0000-0000-000000000005';
SQL
$PSQL -f "$root/supabase/review-drafts/member-profile-candidate.sql"
$PSQL <<'SQL'
do $$begin
 if has_table_privilege('authenticated','kitsnode_member_private.member_signup_profiles_candidate','select') then raise exception 'profile exposed'; end if;
 if has_function_privilege('anon','kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text)','execute') then raise exception 'anon execute'; end if;
end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$begin if kitsnode_member_private.complete_email_profile_candidate('seller','A','01012345678',true,'c@example.test')<>'verification_required' then raise exception 'unconfirmed allowed'; end if; end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
do $$begin if kitsnode_member_private.complete_email_profile_candidate('seller','A','01012345678',true,'d@example.test')<>'verification_required' then raise exception 'naver allowed'; end if; end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
do $$begin if kitsnode_member_private.complete_email_profile_candidate('seller','A','01012345678',true,'e@example.test')<>'consent_required' then raise exception 'consent skipped'; end if; end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$begin
 if kitsnode_member_private.complete_email_profile_candidate('Seller','A','010-1234-5678',true,'stale@example.test')<>'verification_required' then raise exception 'stale email allowed'; end if;
 if kitsnode_member_private.complete_email_profile_candidate('Seller','A','010-1234-5678',false,'a@example.test')<>'invalid_input' then raise exception 'age skipped'; end if;
 if kitsnode_member_private.complete_email_profile_candidate('Seller','A','010-1234-5678',true,'a@example.test')<>'created' then raise exception 'create failed'; end if;
 if kitsnode_member_private.complete_email_profile_candidate('SELLER','A','01012345678',true,'a@example.test')<>'already_registered' then raise exception 'matching retry failed'; end if;
 if kitsnode_member_private.complete_email_profile_candidate('seller','Other','01012345678',true,'a@example.test')<>'profile_exists' then raise exception 'changed name falsely accepted'; end if;
 if kitsnode_member_private.complete_email_profile_candidate('seller','A','01099998888',true,'a@example.test')<>'profile_exists' then raise exception 'changed phone falsely accepted'; end if;
 if kitsnode_member_private.complete_email_profile_candidate('different','A','01012345678',true,'a@example.test')<>'profile_exists' then raise exception 'changed'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$begin if kitsnode_member_private.complete_email_profile_candidate('seller','B','01012345678',true,'b@example.test')<>'username_taken' then raise exception 'duplicate allowed'; end if; end$$;
reset role;
do $$begin if not exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate where user_id='00000000-0000-0000-0000-000000000001' and name='A' and phone='01012345678') then raise exception 'retry modified original profile'; end if; end$$;
insert into kitsnode_member_private.deletion_access_blocks values('00000000-0000-0000-0000-000000000002');
set role authenticated;
do $$begin if kitsnode_member_private.complete_email_profile_candidate('otherid','B','01012345678',true,'b@example.test')<>'unavailable' then raise exception 'withdrawal barrier bypass'; end if; end$$;
reset role;
delete from auth.users where id='00000000-0000-0000-0000-000000000001';
do $$begin if exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate) then raise exception 'profile not deleted'; end if; end$$;
SQL
# Two independently authenticated users race to claim the same normalized ID.
$PSQL <<'SQL'
insert into auth.users values
 ('00000000-0000-0000-0000-000000000006','f@example.test',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000007','g@example.test',now(),'{"provider":"email"}');
insert into public.kitsnode_member_consents select id,'2026-11-14','2026-11-14-naver',now() from auth.users where id in ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
SQL
$PSQL -A -t >"$tmp/first" <<'SQL' &
begin;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000006';
select kitsnode_member_private.complete_email_profile_candidate('RaceID','A','01012345678',true,'f@example.test');
select pg_sleep(1);
commit;
SQL
first=$!
sleep 0.2
$PSQL -A -t >"$tmp/second" <<'SQL' &
begin;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000007';
select kitsnode_member_private.complete_email_profile_candidate('raceid','B','01012345678',true,'g@example.test');
commit;
SQL
second=$!
wait "$first"
wait "$second"
grep -qx 'created' "$tmp/first"
grep -qx 'username_taken' "$tmp/second"
$PSQL <<'SQL'
do $$begin
 if (select count(*) from kitsnode_member_private.member_signup_profiles_candidate where username='raceid') <> 1 then raise exception 'race uniqueness failed'; end if;
end$$;
SQL
printf '%s\n' 'member profile candidate: isolated PostgreSQL checks passed'
