#!/bin/sh
# Disposable local Postgres/Auth only; never points at a hosted project.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
name="kits-policy-$$-$(date +%s)"; net="$name-net"; db="$name-db"; auth="$name-auth"
cleanup(){ docker rm -f "$auth" "$db" >/dev/null 2>&1 || :; docker network rm "$net" >/dev/null 2>&1 || :; }
trap cleanup EXIT HUP INT TERM
docker network create --internal "$net" >/dev/null
docker run --rm -d --name "$db" --network "$net" --network-alias db --memory 768m -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql -c listen_addresses='*' >/dev/null
ready=0
for i in $(seq 1 90); do if docker exec "$db" pg_isready -h db -p 5432 -U supabase_admin -d postgres >/dev/null 2>&1 && docker exec -e PGPASSWORD=local-only-password "$db" psql -h db -p 5432 -U supabase_admin -d postgres -Atqc 'select 1' 2>/dev/null | grep -qx 1; then ready=1; break; fi; sleep 1; done
[ "$ready" = 1 ] || exit 1
docker run --rm -d --name "$auth" --network "$net" --network-alias auth -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://auth:9999 -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL='postgres://supabase_admin:local-only-password@db:5432/postgres?sslmode=disable' -e GOTRUE_SITE_URL=http://localhost -e GOTRUE_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true public.ecr.aws/supabase/gotrue:v2.198.0 >/dev/null
ready=0
for i in $(seq 1 60); do if docker exec "$db" curl -fsS http://auth:9999/health >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
[ "$ready" = 1 ] || exit 1
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create schema kitsnode_member_private;
create schema kitsnode_ads_private;
create function kitsnode_member_private.has_confirmed_email() returns boolean language sql stable as $$select true$$;
grant usage on schema kitsnode_member_private to authenticated;
grant execute on function kitsnode_member_private.has_confirmed_email() to authenticated;
create table public.kitsnode_member_consents(user_id uuid not null references auth.users(id) on delete cascade,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(), primary key(user_id,terms_version,privacy_version));
alter table public.kitsnode_member_consents enable row level security;
grant insert,select on public.kitsnode_member_consents to authenticated;
create policy kitsnode_consent_insert_own on public.kitsnode_member_consents for insert to authenticated with check ((select auth.uid())=user_id and (select kitsnode_member_private.has_confirmed_email()) and terms_version='2026-11-14' and privacy_version='2026-11-14-naver');
create table public.kitsnode_email_profiles(user_id uuid primary key references auth.users(id) on delete cascade,username text not null unique,name text not null,phone text not null);
create table kitsnode_member_private.deletion_access_blocks(subject_id uuid primary key);
create table kitsnode_ads_private.connections(id uuid primary key,user_id uuid,revision bigint,status text);
create table kitsnode_ads_private.shopping_shadow_rules(id uuid primary key,version bigint,connection_id uuid,target_type text,schedule jsonb);
create table kitsnode_ads_private.shadow_schedule_claims(id uuid primary key default gen_random_uuid(),rule_id uuid,rule_version bigint,connection_id uuid,connection_revision bigint,slot_start timestamptz,state text default 'claimed',entry_id uuid,finished_at timestamptz,unique(rule_id,slot_start));
create table kitsnode_ads_private.shopping_shadow_history(id uuid primary key,rule_id uuid,rule_version bigint,result jsonb);
create function kitsnode_ads_private.shadow_account_active_locked(uuid) returns boolean language sql stable as $$select true$$;
create table kitsnode_ads_private.invite_consent_candidate(id uuid primary key,user_id uuid,session_id uuid,ad_account_id text,consent_version text,policy_digest text,recipient text,role text,auto_policy boolean,revoked_at timestamptz,reservation_id uuid,consumed_at timestamptz,expires_at timestamptz);
create table kitsnode_ads_private.invite_naver_policy_confirmation(consent_id uuid primary key,user_id uuid,session_id uuid,ad_account_id text,policy_version text,policy_digest text);
create function kitsnode_ads_private.invite_has_active_connection(uuid,text) returns boolean language sql stable as $$select true$$;
SQL
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 <"$root/supabase/migrations/20261123052616_member_policy_transition.sql" >/dev/null
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create trigger test_consent after insert on auth.users for each row execute function kitsnode_member_private.record_signup_consent();
insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001','{"provider":"email"}','{"kitsnode_consent":{"termsVersion":"2026-11-14","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}'),
('00000000-0000-4000-8000-000000000002','{"provider":"email"}','{"kitsnode_consent":{"termsVersion":"2026-11-23","privacyVersion":"2026-11-23","termsAccepted":true,"privacyAcknowledged":true}}'),
('00000000-0000-4000-8000-000000000003','{"provider":"email"}','{"kitsnode_consent":{"termsVersion":"2026-11-23","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}');
insert into auth.users(id,raw_app_meta_data) values('00000000-0000-4000-8000-000000000004','{"provider":"custom:naver"}');
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
insert into public.kitsnode_member_consents(user_id,terms_version,privacy_version) values('00000000-0000-4000-8000-000000000004','2026-11-23','2026-11-23');
rollback;
do $$begin
 if (select count(*) from public.kitsnode_member_consents)<>2 then raise exception 'incorrect consent evidence count'; end if;
 if not exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000001' and terms_version='2026-11-14' and privacy_version='2026-11-14-naver') then raise exception 'legacy evidence missing'; end if;
 if not exists(select 1 from public.kitsnode_member_consents where user_id='00000000-0000-4000-8000-000000000002' and terms_version='2026-11-23' and privacy_version='2026-11-23') then raise exception 'new evidence missing'; end if;
end$$;
SQL
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
update auth.users set email_confirmed_at=now() where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
insert into auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at)
select id,id::text,id,jsonb_build_object('sub',id::text),'email',now(),now() from auth.users where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
insert into auth.sessions(id,user_id,created_at,updated_at) values
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',now(),now()),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',now(),now()),
('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003',now(),now());
do $$declare r text; begin
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000001"}',true);
 r:=public.kitsnode_complete_email_profile('old_user','Old','01012345678',true); if r<>'created' then raise exception 'old profile: %',r; end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","session_id":"10000000-0000-4000-8000-000000000002"}',true);
 r:=public.kitsnode_complete_email_profile('new_user','New','01012345678',true); if r<>'created' then raise exception 'new profile: %',r; end if;
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","session_id":"10000000-0000-4000-8000-000000000003"}',true);
 r:=public.kitsnode_complete_email_profile('bad_user','Bad','01012345678',true); if r<>'consent_required' then raise exception 'mixed profile: %',r; end if;
end$$;
insert into kitsnode_ads_private.invite_consent_candidate(id,user_id,session_id,ad_account_id,consent_version,policy_digest,recipient,role,auto_policy,expires_at) values
('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','100','v','d','kitsnode','OPERATIONS_VIEWER',true,now()+interval '1 hour'),
('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','100','v','d','kitsnode','OPERATIONS_VIEWER',true,now()+interval '1 hour');
insert into kitsnode_ads_private.invite_naver_policy_confirmation(consent_id,user_id,session_id,ad_account_id,policy_version,policy_digest) select id,user_id,session_id,ad_account_id,'nav-invite-2026-11-21-v1','c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596' from kitsnode_ads_private.invite_consent_candidate;
do $$begin
 if not kitsnode_ads_private.invite_proof_binding_valid_candidate('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','100','viewer',null,'v','d') then raise exception 'old proof failed'; end if;
 if not kitsnode_ads_private.invite_proof_binding_valid_candidate('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','100','viewer',null,'v','d') then raise exception 'new proof failed'; end if;
 if kitsnode_ads_private.invite_proof_binding_valid_candidate('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','100','viewer',null,'v','d') then raise exception 'mixed proof granted'; end if;
end$$;
-- Scheduling is shadow-only in this isolated fixture; both consent versions
-- must work and a member with both versions must not be duplicated.
insert into public.kitsnode_member_consents(user_id,terms_version,privacy_version) values('00000000-0000-4000-8000-000000000001','2026-11-23','2026-11-23');
insert into kitsnode_ads_private.connections(id,user_id,revision,status) values
('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1,'read_connected'),
('30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',1,'read_connected');
insert into kitsnode_ads_private.shopping_shadow_rules(id,version,connection_id,target_type,schedule) values
('40000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000001','product',jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168))),
('40000000-0000-4000-8000-000000000002',1,'30000000-0000-4000-8000-000000000002','product',jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)));
do $$declare slot bigint:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600); result jsonb; claim_id uuid; entry_id uuid; begin
 result:=public.kits_shadow_schedule_candidates(slot,100,null);
 if jsonb_array_length(result->'items')<>2 then raise exception 'candidate count or duplicate failure: %',result; end if;
 result:=public.kits_shadow_schedule_check_rule('40000000-0000-4000-8000-000000000002',1,'30000000-0000-4000-8000-000000000002',slot);
 if result is null then raise exception 'new consent shadow rule failed'; end if;
 result:=public.kits_shadow_schedule_claim('40000000-0000-4000-8000-000000000002',1,'30000000-0000-4000-8000-000000000002',slot);
 claim_id:=(result->>'claimId')::uuid;
 if claim_id is null then raise exception 'new consent shadow claim failed'; end if;
 if public.kits_shadow_schedule_check(claim_id,'40000000-0000-4000-8000-000000000002',1,'30000000-0000-4000-8000-000000000002',slot) is null then raise exception 'new consent shadow check failed'; end if;
 entry_id:=public.kits_shadow_schedule_append(claim_id,'40000000-0000-4000-8000-000000000002',1,'30000000-0000-4000-8000-000000000002',slot,'00000000-0000-4000-8000-000000000002',1,'{"status":"shadow_only","execution":"disabled"}'::jsonb);
 if entry_id is null then raise exception 'new consent shadow append failed'; end if;
end$$;
SQL
# Exercise the real GoTrue signup endpoint as well as the direct trigger fixture.
legacy_response=$(docker exec "$db" curl -fsS -X POST -H 'Content-Type: application/json' --data '{"email":"legacy-policy@example.invalid","password":"LocalOnly12345!","data":{"kitsnode_consent":{"termsVersion":"2026-11-14","privacyVersion":"2026-11-14-naver","termsAccepted":true,"privacyAcknowledged":true}}}' 'http://auth:9999/signup')
new_response=$(docker exec "$db" curl -fsS -X POST -H 'Content-Type: application/json' --data '{"email":"new-policy@example.invalid","password":"LocalOnly12345!","data":{"kitsnode_consent":{"termsVersion":"2026-11-23","privacyVersion":"2026-11-23","termsAccepted":true,"privacyAcknowledged":true}}}' 'http://auth:9999/signup')
legacy_id=$(printf '%s' "$legacy_response" | jq -r '.user.id // .id // empty')
new_id=$(printf '%s' "$new_response" | jq -r '.user.id // .id // empty')
[ -n "$legacy_id" ] && [ -n "$new_id" ] || { echo 'Auth signup did not return users' >&2; exit 1; }
case "$legacy_id:$new_id" in *[!0-9a-fA-F:-]*) echo 'Invalid synthetic ID' >&2; exit 1;; esac
[ "$(docker exec "$db" psql -U supabase_admin -d postgres -Atqc "select count(*) from public.kitsnode_member_consents where (user_id='$legacy_id' and terms_version='2026-11-14' and privacy_version='2026-11-14-naver') or (user_id='$new_id' and terms_version='2026-11-23' and privacy_version='2026-11-23')")" = 2 ] || { echo 'Auth signup evidence missing' >&2; exit 1; }
printf '%s\n' 'Policy transition: both exact pairs allow signup, profile, proof and shadow checks; mixed pair rejected.' 
