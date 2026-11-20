#!/bin/sh
# Isolated PG mock only: no real Supabase or hosted DB connections.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
pg_bin=$(pg_config --bindir)
tmp=$(mktemp -d "${TMPDIR:-/tmp}/kits-atomic-member.XXXXXX")
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
started=0
cleanup(){ if [ "$started" = 1 ]; then "$pg_bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null; fi; rm -rf "$tmp"; }
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
create table public.kitsnode_member_consents(user_id uuid not null references auth.users(id) on delete cascade,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(),primary key(user_id,terms_version,privacy_version));
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key);
insert into auth.users select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('member'||i||'@example.test'),now(),'{"provider":"email"}'::jsonb from generate_series(1,8) i;
insert into auth.sessions select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,null from generate_series(1,8) i;
SQL
$PSQL -f "$root/supabase/review-drafts/member-profile-candidate.sql"
$PSQL -f "$root/supabase/review-drafts/member-atomic-completion-candidate.sql"
$PSQL <<'SQL'
insert into kitsnode_member_private.member_active_documents_candidate values(true,'terms1','privacy1',repeat('a',64),repeat('b',64),1);
do $$begin
 if has_table_privilege('authenticated','kitsnode_member_private.member_active_documents_candidate','select') then raise exception 'active versions exposed'; end if;
 if has_function_privilege('anon','kitsnode_member_private.complete_email_atomic_candidate(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean)','execute') then raise exception 'anon execute'; end if;
end$$;
set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000001','session_id','10000000-0000-4000-8000-000000000001','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin
 if kitsnode_member_private.complete_email_atomic_candidate('seller1','A','01012345678','member1@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'created' then raise exception 'first insert failed'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('SELLER1','A','010-1234-5678','member1@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'already_registered' then raise exception 'matching retry failed'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('seller1','B','01012345678','member1@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'profile_exists' then raise exception 'profile conflict failed'; end if;
end$$;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000002','session_id','10000000-0000-4000-8000-000000000002','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin
 if kitsnode_member_private.complete_email_atomic_candidate('seller2','B','01012345678','member2@example.test','old','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'document_changed' then raise exception 'old doc accepted'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('seller2','B','01012345678','member2@example.test','terms1','privacy1',1,repeat('c',64),repeat('b',64),true,true,true)<>'document_changed' then raise exception 'wrong shown hash accepted'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('seller2','B','01012345678','member2@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,false,true)<>'invalid_input' then raise exception 'consent skipped'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('seller1','B','01012345678','member2@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'username_taken' then raise exception 'conflict not detected'; end if;
end$$;
reset role;
do $$begin
 if (select count(*) from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000001')<>1 then raise exception 'duplicate consent'; end if;
 if exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000002') then raise exception 'failed completion left consent'; end if;
 if exists(select 1 from kitsnode_member_private.member_completion_evidence_candidate where user_id='00000000-0000-4000-8000-000000000002') then raise exception 'failed completion left evidence'; end if;
 if exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate where user_id='00000000-0000-4000-8000-000000000002') then raise exception 'failed completion left profile'; end if;
end$$;
-- A body/hash update without increasing the displayed-document revision fails.
do $$begin
 begin
  update kitsnode_member_private.member_active_documents_candidate set terms_sha256=repeat('c',64) where singleton=true;
  raise exception 'revision guard not enforced';
 exception when others then
  if sqlerrm<>'document_revision_must_increase' then raise; end if;
 end;
end$$;
-- Explicit signout removes the session before a stale claim starts.
delete from auth.sessions where id='10000000-0000-4000-8000-000000000003';
insert into kitsnode_member_private.deletion_access_blocks values('00000000-0000-4000-8000-000000000004');
set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000003','session_id','10000000-0000-4000-8000-000000000003','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_atomic_candidate('seller3','C','01012345678','member3@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'unauthenticated' then raise exception 'logged out allowed'; end if; end$$;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000004','session_id','10000000-0000-4000-8000-000000000004','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_atomic_candidate('seller4','D','01012345678','member4@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true)<>'unavailable' then raise exception 'withdrawal allowed'; end if; end$$;
reset role;
SQL
# Wait for a named transaction to hold its lock and enter pg_sleep.
wait_sleep(){
 app="$1"; ready=0
 for i in $(seq 1 100); do
  if [ "$($PSQL -Atc "select count(*) from pg_stat_activity where application_name='$app' and wait_event='PgSleep'")" = 1 ]; then ready=1; break; fi
  sleep 0.05
 done
 [ "$ready" = 1 ] || { printf 'worker readiness failed: %s\n' "$app" >&2; exit 1; }
}
# Admin updates the active version but does not commit until signup is waiting.
PGAPPNAME=kits_docs_before $PSQL -A -t >"$tmp/docs_before" <<'SQL' &
set statement_timeout='8s'; begin;
update kitsnode_member_private.member_active_documents_candidate set terms_version='terms2',revision=2 where singleton=true;
select pg_sleep(1); commit;
SQL
admin_before=$!
wait_sleep kits_docs_before
$PSQL -A -t >"$tmp/old_claim" <<'SQL' &
set statement_timeout='8s'; begin; set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000005','session_id','10000000-0000-4000-8000-000000000005','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,true);
select kitsnode_member_private.complete_email_atomic_candidate('seller5','E','01012345678','member5@example.test','terms1','privacy1',1,repeat('a',64),repeat('b',64),true,true,true); commit;
SQL
old_claim=$!
wait "$admin_before"; wait "$old_claim"
grep -qx 'document_changed' "$tmp/old_claim"
$PSQL <<'SQL'
do $$begin if exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000005') then raise exception 'stale version recorded'; end if; end$$;
SQL
# Signup holds the active-version share lock; the following admin update must
# wait until the atomic consent+profile transaction has completed.
PGAPPNAME=kits_claim_before $PSQL -A -t >"$tmp/claim_before" <<'SQL' &
set statement_timeout='8s'; begin; set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000006','session_id','10000000-0000-4000-8000-000000000006','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,true);
select kitsnode_member_private.complete_email_atomic_candidate('seller6','F','01012345678','member6@example.test','terms2','privacy1',2,repeat('a',64),repeat('b',64),true,true,true);
select pg_sleep(1); commit;
SQL
claim_before=$!
wait_sleep kits_claim_before
$PSQL -A -t >"$tmp/docs_after" <<'SQL' &
set statement_timeout='8s'; update kitsnode_member_private.member_active_documents_candidate set terms_version='terms3',revision=3 where singleton=true;
SQL
admin_after=$!
wait "$claim_before"; wait "$admin_after"
grep -qx 'created' "$tmp/claim_before"
$PSQL <<'SQL'
do $$begin
 if not exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000006' and terms_version='terms2') then raise exception 'version before update lost'; end if;
 if not exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate where user_id='00000000-0000-4000-8000-000000000006') then raise exception 'atomic profile missing'; end if;
 if not exists(select 1 from kitsnode_member_private.member_active_documents_candidate where terms_version='terms3') then raise exception 'new version absent'; end if;
end$$;
SQL
# Signout wins the session row before completion: completion sees no session
# and must leave no new consent or profile.
PGAPPNAME=kits_logout_before $PSQL -A -t >"$tmp/logout" <<'SQL' &
set statement_timeout='8s'; begin;
delete from auth.sessions where id='10000000-0000-4000-8000-000000000007'; select pg_sleep(1); commit;
SQL
logout=$!
wait_sleep kits_logout_before
$PSQL -A -t >"$tmp/after_logout" <<'SQL' &
set statement_timeout='8s'; begin; set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000007','session_id','10000000-0000-4000-8000-000000000007','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,true);
select kitsnode_member_private.complete_email_atomic_candidate('seller7','G','01012345678','member7@example.test','terms3','privacy1',3,repeat('a',64),repeat('b',64),true,true,true); commit;
SQL
after_logout=$!
wait "$logout"; wait "$after_logout"
grep -qx 'unauthenticated' "$tmp/after_logout"
$PSQL <<'SQL'
do $$begin if exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000007') or exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate where user_id='00000000-0000-4000-8000-000000000007') then raise exception 'logout race left data'; end if; end$$;
SQL
# Same document version, changed body digest: both stale displayed hash and
# stale revision must be refused even when the version string is unchanged;
# a newly confirmed matching body must produce a distinct evidence record.
$PSQL <<'SQL'
set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000005','session_id','10000000-0000-4000-8000-000000000005','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin if kitsnode_member_private.complete_email_atomic_candidate('seller5','E','01012345678','member5@example.test','terms3','privacy1',3,repeat('a',64),repeat('b',64),true,true,true)<>'created' then raise exception 'first same-version profile failed'; end if; end$$;
reset role;
update kitsnode_member_private.member_active_documents_candidate set terms_sha256=repeat('c',64),revision=4 where singleton=true;
set role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000005','session_id','10000000-0000-4000-8000-000000000005','exp',extract(epoch from now()+interval '1 hour')::bigint)::text,false);
do $$begin
 if kitsnode_member_private.complete_email_atomic_candidate('seller5','E','01012345678','member5@example.test','terms3','privacy1',4,repeat('a',64),repeat('b',64),true,true,true)<>'document_changed' then raise exception 'changed body hash accepted'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('seller5','E','01012345678','member5@example.test','terms3','privacy1',3,repeat('c',64),repeat('b',64),true,true,true)<>'document_changed' then raise exception 'stale revision accepted'; end if;
 if kitsnode_member_private.complete_email_atomic_candidate('seller5','E','01012345678','member5@example.test','terms3','privacy1',4,repeat('c',64),repeat('b',64),true,true,true)<>'already_registered' then raise exception 'new same-version consent failed'; end if;
end$$;
reset role;
do $$begin
 if (select count(*) from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000005')<>1 then raise exception 'legacy consent duplicated'; end if;
 if (select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='00000000-0000-4000-8000-000000000005')<>2 then raise exception 'revision evidence missing'; end if;
 if not exists(select 1 from kitsnode_member_private.member_completion_evidence_candidate where user_id='00000000-0000-4000-8000-000000000005' and document_revision=3 and terms_sha256=repeat('a',64)) then raise exception 'old consent evidence lost'; end if;
 if not exists(select 1 from kitsnode_member_private.member_completion_evidence_candidate where user_id='00000000-0000-4000-8000-000000000005' and document_revision=4 and terms_sha256=repeat('c',64)) then raise exception 'new consent evidence missing'; end if;
end$$;
SQL
printf '%s\n' 'atomic-completion candidate: isolated PostgreSQL checks passed'
