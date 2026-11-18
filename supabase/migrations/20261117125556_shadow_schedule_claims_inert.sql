-- INERT durable coordination for future read-only scheduled simulations.
-- No timer, HTTP endpoint, bid mutation, credentials or activation switch.
create table kitsnode_ads_private.shadow_schedule_claims (
 id uuid primary key default gen_random_uuid(),
 rule_id uuid not null references kitsnode_ads_private.shopping_shadow_rules(id),
 rule_version bigint not null check(rule_version>=0),
 connection_id uuid not null references kitsnode_ads_private.connections(id),
 connection_revision bigint not null check(connection_revision>=0),
 slot_start timestamptz not null,
 state text not null default 'claimed' check(state in ('claimed','recorded','skipped','uncertain')),
 entry_id uuid references kitsnode_ads_private.shopping_shadow_history(id),
 reason text check(reason in ('hour_expired','authorization_changed','simulation_or_authorization_failed','invalid_simulation_result')),
 created_at timestamptz not null default now(), finished_at timestamptz,
 unique(rule_id,slot_start),
 check((state='claimed' and finished_at is null and entry_id is null and reason is null) or
       (state='recorded' and finished_at is not null and entry_id is not null and reason is null) or
       (state in ('skipped','uncertain') and finished_at is not null and entry_id is null and reason is not null))
);
alter table kitsnode_ads_private.shadow_schedule_claims enable row level security;
revoke all on kitsnode_ads_private.shadow_schedule_claims from public,anon,authenticated,service_role;
grant select,insert,update on kitsnode_ads_private.shadow_schedule_claims to service_role;

-- Stable UUID keyset pagination. No matching account data beyond the selected
-- bounded page is returned; a 10000-record run cap remains enforced upstream.
-- Clock mismatch is distinct from a genuinely empty page.
create function public.kits_shadow_schedule_candidates(p_slot_start_ms bigint,p_limit integer,p_after_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when p_slot_start_ms is distinct from 1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600) then jsonb_build_object('status','clock_mismatch') else (
  with candidates as materialized (
   select r.id,r.version,r.connection_id,r.schedule
   from kitsnode_ads_private.shopping_shadow_rules r
   join kitsnode_ads_private.connections c on c.id=r.connection_id
   join public.kitsnode_member_consents m on m.user_id=c.user_id
    and m.terms_version='2026-11-14' and m.privacy_version='2026-11-14-naver' and m.accepted_at is not null
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
$$;

-- Short transaction locks current connection, rule and consent, then persists
-- one claim per UTC hour. An uncertain claim is NEVER released for retry.
create function public.kits_shadow_schedule_claim(p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype; claim kitsnode_ads_private.shadow_schedule_claims%rowtype;
begin
 if p_slot_start_ms is null or p_slot_start_ms<0 or p_rule_version is null or p_rule_version<0 or
    p_slot_start_ms<>1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600) then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=p_connection_id and status='read_connected' for update;
 if not found then return null; end if;
 select * into r from kitsnode_ads_private.shopping_shadow_rules where id=p_rule_id and connection_id=c.id and version=p_rule_version and target_type in ('product','keyword') for update;
 if not found or r.schedule->>'timezone' is distinct from 'Asia/Seoul' or r.schedule->>'slots' !~ '^[01]{168}$' or
    substring(r.schedule->>'slots' from ((extract(isodow from statement_timestamp() at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from statement_timestamp() at time zone 'Asia/Seoul')::integer+1) for 1) is distinct from '1' then return null; end if;
 perform 1 from public.kitsnode_member_consents where user_id=c.user_id and terms_version='2026-11-14' and privacy_version='2026-11-14-naver' and accepted_at is not null for share;
 if not found then return null; end if;
 insert into kitsnode_ads_private.shadow_schedule_claims(rule_id,rule_version,connection_id,connection_revision,slot_start)
 values(r.id,r.version,c.id,c.revision,to_timestamp(p_slot_start_ms/1000.0))
 on conflict(rule_id,slot_start) do nothing returning * into claim;
 if claim.id is null then return null; end if;
 return jsonb_build_object('claimId',claim.id,'ruleId',r.id,'ruleVersion',r.version,'connectionId',c.id,'slotStartMs',p_slot_start_ms);
end $$;

-- Finish is idempotent for the same result, never recreates a claim, and never
-- deletes/reopens one. A recorded history entry must belong to this claim's
-- rule and version and be newer than the claim itself.
create function public.kits_shadow_schedule_finish(p_claim_id uuid,p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint,p_state text,p_entry_id uuid,p_reason text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v kitsnode_ads_private.shadow_schedule_claims%rowtype;
begin
 if p_state is null or p_state not in ('recorded','skipped','uncertain') or
   (p_state='recorded' and (p_entry_id is null or p_reason is not null)) or
   (p_state in ('skipped','uncertain') and (p_entry_id is not null or p_reason is null or p_reason not in ('hour_expired','authorization_changed','simulation_or_authorization_failed','invalid_simulation_result'))) then return false; end if;
 select * into v from kitsnode_ads_private.shadow_schedule_claims where id=p_claim_id and rule_id=p_rule_id and rule_version=p_rule_version and connection_id=p_connection_id and slot_start=to_timestamp(p_slot_start_ms/1000.0) for update;
 if not found then return false; end if;
 if v.state<>'claimed' then return v.state=p_state and v.entry_id is not distinct from p_entry_id and v.reason is not distinct from p_reason; end if;
 if p_state='recorded' and not exists(select 1 from kitsnode_ads_private.shopping_shadow_history h where h.id=p_entry_id and h.rule_id=v.rule_id and h.rule_version=v.rule_version and h.created_at>=v.created_at and h.result->>'execution'='disabled' and h.result->>'status'='shadow_only') then return false; end if;
 update kitsnode_ads_private.shadow_schedule_claims set state=p_state,entry_id=p_entry_id,reason=p_reason,finished_at=now() where id=v.id;
 return true;
end $$;
revoke all on function public.kits_shadow_schedule_candidates(bigint,integer,uuid),public.kits_shadow_schedule_claim(uuid,bigint,uuid,bigint),public.kits_shadow_schedule_finish(uuid,uuid,bigint,uuid,bigint,text,uuid,text) from public,anon,authenticated;
grant execute on function public.kits_shadow_schedule_candidates(bigint,integer,uuid),public.kits_shadow_schedule_claim(uuid,bigint,uuid,bigint),public.kits_shadow_schedule_finish(uuid,uuid,bigint,uuid,bigint,text,uuid,text) to service_role;

-- The worker uses this only through a server-side service-role connection and
-- must also consult the Auth admin API for disabled, anonymous or banned users.
-- The browser cannot invoke this function. No JWT is created or stored.
create function public.kits_shadow_schedule_check(p_claim_id uuid,p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('userId',c.user_id,'ruleId',r.id,'ruleVersion',r.version,'connectionId',c.id,'connectionRevision',c.revision,'slotStartMs',p_slot_start_ms,'schedule',r.schedule)
 from kitsnode_ads_private.shadow_schedule_claims a
 join kitsnode_ads_private.connections c on c.id=a.connection_id
 join kitsnode_ads_private.shopping_shadow_rules r on r.id=a.rule_id and r.connection_id=c.id
 join public.kitsnode_member_consents m on m.user_id=c.user_id and m.terms_version='2026-11-14' and m.privacy_version='2026-11-14-naver' and m.accepted_at is not null
 where a.id=p_claim_id and a.rule_id=p_rule_id and a.rule_version=p_rule_version and a.connection_id=p_connection_id
  and a.slot_start=to_timestamp(p_slot_start_ms/1000.0) and a.state='claimed'
  and p_slot_start_ms=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600)
  and c.status='read_connected' and c.revision=a.connection_revision and r.version=a.rule_version
  and r.schedule->>'timezone'='Asia/Seoul' and r.schedule->>'slots' ~ '^[01]{168}$'
  and substring(r.schedule->>'slots' from ((extract(isodow from a.slot_start at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from a.slot_start at time zone 'Asia/Seoul')::integer+1) for 1)='1';
$$;

-- Private, narrow exception to invoker access: the service role cannot read
-- auth.users. Only a boolean for the requested UUID is returned, and FOR
-- SHARE holds the user row through the caller's append transaction so a ban,
-- deletion or anonymization cannot race the final simulated history write.
create function kitsnode_ads_private.shadow_account_active_locked(p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_user_id is null then return false; end if;
 perform 1 from auth.users where id=p_user_id and is_anonymous is false and deleted_at is null
  and confirmed_at is not null and (banned_until is null or banned_until<=statement_timestamp()) for share;
 return found;
end $$;
revoke all on function kitsnode_ads_private.shadow_account_active_locked(uuid) from public,anon,authenticated,service_role;
grant execute on function kitsnode_ads_private.shadow_account_active_locked(uuid) to service_role;

-- This is the only scheduled history writer. Connection, rule, consent and
-- claim are locked together; a revoked or modified rule cannot leave a result.
-- No provider mutation exists in this path. Claim and history are bound in the
-- same transaction so a timeout is never retried as a second simulation.
create function public.kits_shadow_schedule_append(p_claim_id uuid,p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint,p_user_id uuid,p_connection_revision bigint,p_result jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype; a kitsnode_ads_private.shadow_schedule_claims%rowtype; v_id uuid; v_day integer; v_hour integer; v_result jsonb;
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' or p_result->>'status' is distinct from 'shadow_only' or p_result->>'execution' is distinct from 'disabled' or octet_length(p_result::text)>7000 then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=p_connection_id and user_id=p_user_id and revision=p_connection_revision and status='read_connected' for update;
 if not found then return null; end if;
 select * into r from kitsnode_ads_private.shopping_shadow_rules where id=p_rule_id and connection_id=c.id and version=p_rule_version and target_type in ('product','keyword') for update;
 if not found or r.schedule->>'timezone' is distinct from 'Asia/Seoul' or r.schedule->>'slots' !~ '^[01]{168}$' then return null; end if;
 perform 1 from public.kitsnode_member_consents where user_id=c.user_id and terms_version='2026-11-14' and privacy_version='2026-11-14-naver' and accepted_at is not null for share;
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
end $$;
revoke all on function public.kits_shadow_schedule_check(uuid,uuid,bigint,uuid,bigint),public.kits_shadow_schedule_append(uuid,uuid,bigint,uuid,bigint,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.kits_shadow_schedule_check(uuid,uuid,bigint,uuid,bigint),public.kits_shadow_schedule_append(uuid,uuid,bigint,uuid,bigint,uuid,bigint,jsonb) to service_role;

-- Preliminary and pre-execution rule check. Auth user status is separately
-- verified by the service client; this never trusts any browser token.
create function public.kits_shadow_schedule_check_rule(p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('userId',c.user_id,'ruleId',r.id,'ruleVersion',r.version,'connectionId',c.id,'connectionRevision',c.revision,'slotStartMs',p_slot_start_ms,'schedule',r.schedule)
 from kitsnode_ads_private.connections c
 join kitsnode_ads_private.shopping_shadow_rules r on r.connection_id=c.id
 join public.kitsnode_member_consents m on m.user_id=c.user_id and m.terms_version='2026-11-14' and m.privacy_version='2026-11-14-naver' and m.accepted_at is not null
 where c.id=p_connection_id and c.status='read_connected' and r.id=p_rule_id and r.version=p_rule_version and r.target_type in ('product','keyword')
  and p_slot_start_ms=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600)
  and r.schedule->>'timezone'='Asia/Seoul' and r.schedule->>'slots' ~ '^[01]{168}$'
  and substring(r.schedule->>'slots' from ((extract(isodow from statement_timestamp() at time zone 'Asia/Seoul')::integer-1)*24+extract(hour from statement_timestamp() at time zone 'Asia/Seoul')::integer+1) for 1)='1';
$$;
revoke all on function public.kits_shadow_schedule_check_rule(uuid,bigint,uuid,bigint) from public,anon,authenticated;
grant execute on function public.kits_shadow_schedule_check_rule(uuid,bigint,uuid,bigint) to service_role;
