-- Stage both known document versions before clients change. Old and new
-- consent evidence remains distinct; no historical record is rewritten.
create or replace function kitsnode_member_private.record_signup_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare t text; p text; e jsonb := new.raw_user_meta_data->'kitsnode_consent';
begin
 if new.raw_app_meta_data->>'provider' is distinct from 'email' then return new; end if;
 if e = jsonb_build_object('termsVersion','2026-11-14','privacyVersion','2026-11-14-naver','termsAccepted',true,'privacyAcknowledged',true) then
  t:='2026-11-14'; p:='2026-11-14-naver';
 elsif e = jsonb_build_object('termsVersion','2026-11-23','privacyVersion','2026-11-23','termsAccepted',true,'privacyAcknowledged',true) then
  t:='2026-11-23'; p:='2026-11-23';
 else return new; end if;
 insert into public.kitsnode_member_consents(user_id,terms_version,privacy_version) values(new.id,t,p) on conflict do nothing;
 return new;
end $$;

create or replace function public.kitsnode_complete_email_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean)
returns text language plpgsql security definer set search_path='' as $$
declare subject uuid:=(select auth.uid()); sid uuid; session_end timestamptz; u text:=lower(btrim(p_username)); n text:=btrim(p_name); p text:=regexp_replace(btrim(p_phone),'[ -]','','g'); existing public.kitsnode_email_profiles%rowtype;
begin
 if subject is null or coalesce((select auth.jwt())->>'session_id','') !~* '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$' then return 'verification_required'; end if;
 sid:=((select auth.jwt())->>'session_id')::uuid;
 if u is null or u !~ '^[a-z0-9][a-z0-9_-]{3,19}$' or n is null or char_length(n) not between 1 and 100 or n ~ '[[:cntrl:]]' or p_phone is null or btrim(p_phone) !~ '^[0-9 -]+$' or p !~ '^01[016789][0-9]{7,8}$' or p_age_confirmed is distinct from true then return 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(subject::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=subject) then return 'unavailable'; end if;
 select not_after into session_end from auth.sessions where id=sid and user_id=subject for share;
 if not found or (session_end is not null and session_end<=clock_timestamp()) then return 'verification_required'; end if;
 if not exists(select 1 from auth.users where id=subject and email_confirmed_at is not null) or not exists(select 1 from auth.identities where user_id=subject and provider='email') then return 'verification_required'; end if;
 perform 1 from public.kitsnode_member_consents where user_id=subject and (terms_version,privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and accepted_at is not null for share;
 if not found then return 'consent_required'; end if;
 select * into existing from public.kitsnode_email_profiles where user_id=subject;
 if found then if existing.username=u and existing.name=n and existing.phone=p then return 'already_registered'; else return 'profile_exists'; end if; end if;
 begin
  insert into public.kitsnode_email_profiles(user_id,username,name,phone) values(subject,u,n,p);
 exception when unique_violation then return 'username_taken'; end;
 return 'created';
end $$;

create or replace function kitsnode_ads_private.invite_proof_binding_valid_candidate(
 p_consent uuid,p_user uuid,p_session uuid,p_account text,p_viewer text,p_evidence uuid,p_version text,p_digest text
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare sess uuid; con uuid; member uuid; policy uuid;
begin
 select id into sess from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()) for share;
 if sess is null then return false; end if;
 select user_id into member from public.kitsnode_member_consents where user_id=p_user and (terms_version,privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) limit 1 for share;
 if member is null then return false; end if;
 if not kitsnode_ads_private.invite_has_active_connection(p_user,p_account) then return false; end if;
 select id into con from kitsnode_ads_private.invite_consent_candidate where id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=p_account and consent_version=p_version and policy_digest=p_digest and recipient='kitsnode' and role='OPERATIONS_VIEWER' and auto_policy and revoked_at is null and expires_at>clock_timestamp() for update;
 if con is null then return false; end if;
 select consent_id into policy from kitsnode_ads_private.invite_naver_policy_confirmation where consent_id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=p_account and policy_version='nav-invite-2026-11-21-v1' and policy_digest='c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596' for share;
 if policy is null then return false; end if;
 -- Viewer is an assertion and is never evidence. This path only establishes
 -- consent to attempt an invitation, not account ownership or data access.
 return p_evidence is null;
end $$;

-- Keep the existing ownership and provider verification checks while allowing
-- only these two published version pairs during the staged rollout.
alter policy kitsnode_consent_insert_own on public.kitsnode_member_consents
with check ((select auth.uid())=user_id and (select kitsnode_member_private.has_confirmed_email()) and
  (terms_version,privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')));

-- Staged consent compatibility only: preserve the existing scheduling logic.
CREATE OR REPLACE FUNCTION public.kits_shadow_schedule_append(p_claim_id uuid, p_rule_id uuid, p_rule_version bigint, p_connection_id uuid, p_slot_start_ms bigint, p_user_id uuid, p_connection_revision bigint, p_result jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype; a kitsnode_ads_private.shadow_schedule_claims%rowtype; v_id uuid; v_day integer; v_hour integer; v_result jsonb;
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' or p_result->>'status' is distinct from 'shadow_only' or p_result->>'execution' is distinct from 'disabled' or octet_length(p_result::text)>7000 then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=p_connection_id and user_id=p_user_id and revision=p_connection_revision and status='read_connected' for update;
 if not found then return null; end if;
 select * into r from kitsnode_ads_private.shopping_shadow_rules where id=p_rule_id and connection_id=c.id and version=p_rule_version and target_type in ('product','keyword') for update;
 if not found or r.schedule->>'timezone' is distinct from 'Asia/Seoul' or r.schedule->>'slots' !~ '^[01]{168}$' then return null; end if;
 perform 1 from public.kitsnode_member_consents where user_id=c.user_id and (terms_version,privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and accepted_at is not null for share;
 if not found then return null; end if;
 if kitsnode_ads_private.shadow_account_active_locked(c.user_id) is not true then return null; end if;
 select * into a from kitsnode_ads_private.shadow_schedule_claims where id=p_claim_id and rule_id=p_rule_id and rule_version=p_rule_version and connection_id=c.id and connection_revision=c.revision and slot_start=to_timestamp(p_slot_start_ms/1000.0) and state='claimed' for update;
 if not found then return null; end if;
 v_day:=extract(isodow from a.slot_start at time zone 'Asia/Seoul')::integer-1;
 v_hour:=extract(hour from a.slot_start at time zone 'Asia/Seoul')::integer;
 if substring(r.schedule->>'slots' from (v_day*24+v_hour+1) for 1) is distinct from '1' then return null; end if;
 v_result:=p_result||jsonb_build_object('executionMode','scheduled','scheduleEvaluation',jsonb_build_object('status','on','timezone','Asia/Seoul','day',(array['mon','tue','wed','thu','fri','sat','sun'])[v_day+1],'hour',v_hour,'slotIndex',v_day*24+v_hour,'evaluatedAt',a.slot_start));
 insert into kitsnode_ads_private.shopping_shadow_history(id,rule_id,rule_version,result) values(gen_random_uuid(),r.id,r.version,v_result) returning id into v_id;
 update kitsnode_ads_private.shadow_schedule_claims set state='recorded',entry_id=v_id,finished_at=now() where id=a.id;
 return v_id;
end $function$;

-- Staged consent compatibility only: preserve the existing scheduling logic.
CREATE OR REPLACE FUNCTION public.kits_shadow_schedule_candidates(p_slot_start_ms bigint, p_limit integer, p_after_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select case when p_slot_start_ms is distinct from 1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600) then jsonb_build_object('status','clock_mismatch') else (
  with candidates as materialized (
   select r.id,r.version,r.connection_id,r.schedule
   from kitsnode_ads_private.shopping_shadow_rules r
   join kitsnode_ads_private.connections c on c.id=r.connection_id
   join lateral (select 1 from public.kitsnode_member_consents m where m.user_id=c.user_id and (m.terms_version,m.privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and m.accepted_at is not null limit 1) consent on true
   where p_limit between 1 and 1000 and p_slot_start_ms>=0
    and c.status='read_connected' and r.target_type in ('product','keyword')
    and (p_after_id is null or r.id>p_after_id)
    and r.schedule->>'timezone'='Asia/Seoul' and r.schedule->>'slots' ~ '^[01]{168}$'
    and substring(r.schedule->>'slots' from ((extract(isodow from statement_timestamp() at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from statement_timestamp() at time zone 'Asia/Seoul')::integer+1) for 1)='1'
   order by r.id limit least(greatest(coalesce(p_limit,0),0)+1,1001)
  ), page as (select * from candidates order by id limit greatest(coalesce(p_limit,0),0))
  select jsonb_build_object('status','ok','items',
   coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'connectionId',connection_id,'schedule',schedule) order by id) from page),'[]'::jsonb),
   'nextCursor',case when (select count(*) from candidates)>p_limit then (select id from page order by id desc limit 1) else null end)
 ) end;
$function$;

-- Staged consent compatibility only: preserve the existing scheduling logic.
CREATE OR REPLACE FUNCTION public.kits_shadow_schedule_check(p_claim_id uuid, p_rule_id uuid, p_rule_version bigint, p_connection_id uuid, p_slot_start_ms bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('userId',c.user_id,'ruleId',r.id,'ruleVersion',r.version,'connectionId',c.id,'connectionRevision',c.revision,'slotStartMs',p_slot_start_ms,'schedule',r.schedule)
 from kitsnode_ads_private.shadow_schedule_claims a
 join kitsnode_ads_private.connections c on c.id=a.connection_id
 join kitsnode_ads_private.shopping_shadow_rules r on r.id=a.rule_id and r.connection_id=c.id
 join lateral (select 1 from public.kitsnode_member_consents m where m.user_id=c.user_id and (m.terms_version,m.privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and m.accepted_at is not null limit 1) consent on true
 where a.id=p_claim_id and a.rule_id=p_rule_id and a.rule_version=p_rule_version and a.connection_id=p_connection_id
  and a.slot_start=to_timestamp(p_slot_start_ms/1000.0) and a.state='claimed'
  and p_slot_start_ms=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600)
  and c.status='read_connected' and c.revision=a.connection_revision and r.version=a.rule_version
  and r.schedule->>'timezone'='Asia/Seoul' and r.schedule->>'slots' ~ '^[01]{168}$'
  and substring(r.schedule->>'slots' from ((extract(isodow from a.slot_start at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from a.slot_start at time zone 'Asia/Seoul')::integer+1) for 1)='1';
$function$;

-- Staged consent compatibility only: preserve the existing scheduling logic.
CREATE OR REPLACE FUNCTION public.kits_shadow_schedule_check_rule(p_rule_id uuid, p_rule_version bigint, p_connection_id uuid, p_slot_start_ms bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('userId',c.user_id,'ruleId',r.id,'ruleVersion',r.version,'connectionId',c.id,'connectionRevision',c.revision,'slotStartMs',p_slot_start_ms,'schedule',r.schedule)
 from kitsnode_ads_private.connections c
 join kitsnode_ads_private.shopping_shadow_rules r on r.connection_id=c.id
 join lateral (select 1 from public.kitsnode_member_consents m where m.user_id=c.user_id and (m.terms_version,m.privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and m.accepted_at is not null limit 1) consent on true
 where c.id=p_connection_id and c.status='read_connected' and r.id=p_rule_id and r.version=p_rule_version and r.target_type in ('product','keyword')
  and p_slot_start_ms=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600)
  and r.schedule->>'timezone'='Asia/Seoul' and r.schedule->>'slots' ~ '^[01]{168}$'
  and substring(r.schedule->>'slots' from ((extract(isodow from statement_timestamp() at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from statement_timestamp() at time zone 'Asia/Seoul')::integer+1) for 1)='1';
$function$;

-- Staged consent compatibility only: preserve the existing scheduling logic.
CREATE OR REPLACE FUNCTION public.kits_shadow_schedule_claim(p_rule_id uuid, p_rule_version bigint, p_connection_id uuid, p_slot_start_ms bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype; claim kitsnode_ads_private.shadow_schedule_claims%rowtype;
begin
 if p_slot_start_ms is null or p_slot_start_ms<0 or p_rule_version is null or p_rule_version<0 or
    p_slot_start_ms<>1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600) then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=p_connection_id and status='read_connected' for update;
 if not found then return null; end if;
 select * into r from kitsnode_ads_private.shopping_shadow_rules where id=p_rule_id and connection_id=c.id and version=p_rule_version and target_type in ('product','keyword') for update;
 if not found or r.schedule->>'timezone' is distinct from 'Asia/Seoul' or r.schedule->>'slots' !~ '^[01]{168}$' or
    substring(r.schedule->>'slots' from ((extract(isodow from statement_timestamp() at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from statement_timestamp() at time zone 'Asia/Seoul')::integer+1) for 1) is distinct from '1' then return null; end if;
 perform 1 from public.kitsnode_member_consents where user_id=c.user_id and (terms_version,privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and accepted_at is not null for share;
 if not found then return null; end if;
 insert into kitsnode_ads_private.shadow_schedule_claims(rule_id,rule_version,connection_id,connection_revision,slot_start)
 values(r.id,r.version,c.id,c.revision,to_timestamp(p_slot_start_ms/1000.0))
 on conflict(rule_id,slot_start) do nothing returning * into claim;
 if claim.id is null then return null; end if;
 return jsonb_build_object('claimId',claim.id,'ruleId',r.id,'ruleVersion',r.version,'connectionId',c.id,'slotStartMs',p_slot_start_ms);
end $function$;

-- Preserve the existing server-only execution boundary even if a function was
-- absent in another environment before this compatibility migration.
revoke all on function public.kits_shadow_schedule_append(uuid,uuid,bigint,uuid,bigint,uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.kits_shadow_schedule_candidates(bigint,integer,uuid) from public,anon,authenticated;
revoke all on function public.kits_shadow_schedule_check(uuid,uuid,bigint,uuid,bigint) from public,anon,authenticated;
revoke all on function public.kits_shadow_schedule_check_rule(uuid,bigint,uuid,bigint) from public,anon,authenticated;
revoke all on function public.kits_shadow_schedule_claim(uuid,bigint,uuid,bigint) from public,anon,authenticated;
grant execute on function public.kits_shadow_schedule_append(uuid,uuid,bigint,uuid,bigint,uuid,bigint,jsonb) to service_role;
grant execute on function public.kits_shadow_schedule_candidates(bigint,integer,uuid) to service_role;
grant execute on function public.kits_shadow_schedule_check(uuid,uuid,bigint,uuid,bigint) to service_role;
grant execute on function public.kits_shadow_schedule_check_rule(uuid,bigint,uuid,bigint) to service_role;
grant execute on function public.kits_shadow_schedule_claim(uuid,bigint,uuid,bigint) to service_role;
