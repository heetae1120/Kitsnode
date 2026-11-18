-- ISOLATED TEST CANDIDATE ONLY: NOT A DEPLOYABLE SUPABASE MIGRATION.
-- The legacy shared service_role review path cannot independently authenticate
-- an operator and must never be applied to the live or staging project.
-- Append-only human review is separate from the immutable claim/slot ledger.
-- The trusted server verifies the operator JWT and allowlist before using this
-- service-role-only database boundary; a service key is never sent to clients.
create table kitsnode_ads_private.shadow_claim_reviews (
 claim_id uuid not null references kitsnode_ads_private.shadow_schedule_claims(id),
 observed_state text not null check(observed_state in ('claimed','uncertain','skipped')),
 operator_id uuid not null,
 case_ref text not null check(case_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
 reviewed_at timestamptz not null default statement_timestamp(),
 primary key(claim_id,observed_state)
);
alter table kitsnode_ads_private.shadow_claim_reviews enable row level security;
revoke all on kitsnode_ads_private.shadow_claim_reviews from public,anon,authenticated,service_role;
grant select,insert on kitsnode_ads_private.shadow_claim_reviews to service_role;

-- Additive, service-role-only outcome classification. The existing RPC and its
-- return contract remain unchanged for already-running workers.
create function public.kits_shadow_schedule_claim_v2(p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_claim jsonb; v_state text; v_reason text; v_connection uuid; v_created_at timestamptz;
begin
 v_claim:=public.kits_shadow_schedule_claim(p_rule_id,p_rule_version,p_connection_id,p_slot_start_ms);
 if v_claim is not null then return jsonb_build_object('status','claimed','claim',v_claim); end if;
 select a.state,a.reason,a.connection_id,a.created_at into v_state,v_reason,v_connection,v_created_at from kitsnode_ads_private.shadow_schedule_claims a
 where a.rule_id=p_rule_id and a.slot_start=to_timestamp(p_slot_start_ms/1000.0);
 if v_connection is distinct from p_connection_id then return jsonb_build_object('status','rejected'); end if;
 if v_state='recorded' then return jsonb_build_object('status','already_recorded'); end if;
 if v_state='skipped' and v_reason in ('hour_expired','authorization_changed') then return jsonb_build_object('status','already_skipped'); end if;
 if v_state='claimed' and v_created_at>=statement_timestamp()-interval '10 minutes' then return jsonb_build_object('status','in_progress'); end if;
 if v_state in ('claimed','uncertain','skipped') then return jsonb_build_object('status','unresolved'); end if;
 return jsonb_build_object('status','rejected');
end $$;

-- Bound the hourly check to the unresolved subsets as historical ledger grows.
create index shadow_schedule_claims_stale_idx on kitsnode_ads_private.shadow_schedule_claims(created_at) where state='claimed';
create index shadow_schedule_claims_uncertain_idx on kitsnode_ads_private.shadow_schedule_claims(id) where state='uncertain';
create index shadow_schedule_claims_unexpected_skip_idx on kitsnode_ads_private.shadow_schedule_claims(id) where state='skipped' and reason not in ('hour_expired','authorization_changed');
-- Aggregate only; preserve claims and never release them for a retry.
create function public.kits_shadow_schedule_unresolved() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('staleClaimed',(select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='claimed' and a.created_at < statement_timestamp()-interval '10 minutes'),
                           'uncertain',(select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='uncertain')+
                             (select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='skipped' and a.reason not in ('hour_expired','authorization_changed')));
$$;

create function public.kits_shadow_claim_review_queue() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at,q.claim_id),'[]'::jsonb) from (
  select a.id claim_id,a.rule_id,a.connection_id,a.slot_start,a.state,a.reason,a.created_at,a.finished_at,
         exists(select 1 from kitsnode_ads_private.shadow_claim_reviews r where r.claim_id=a.id and r.observed_state=a.state) review_recorded
  from kitsnode_ads_private.shadow_schedule_claims a
  where ((a.state='claimed' and a.created_at<statement_timestamp()-interval '10 minutes') or a.state='uncertain' or (a.state='skipped' and a.reason not in ('hour_expired','authorization_changed')))
  order by a.created_at,a.id limit 100
 ) q;
$$;
create function public.kits_shadow_claim_review_record(p_claim_id uuid,p_expected_state text,p_operator_id uuid,p_case_ref text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare a kitsnode_ads_private.shadow_schedule_claims%rowtype; v_inserted integer;
begin
 if p_claim_id is null or p_operator_id is null or p_expected_state not in ('claimed','uncertain','skipped') or p_case_ref is null or p_case_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' then return false; end if;
 select * into a from kitsnode_ads_private.shadow_schedule_claims where id=p_claim_id for update;
 if not found or a.state is distinct from p_expected_state or not ((a.state='claimed' and a.created_at<statement_timestamp()-interval '10 minutes') or a.state='uncertain' or (a.state='skipped' and a.reason not in ('hour_expired','authorization_changed'))) then return false; end if;
 insert into kitsnode_ads_private.shadow_claim_reviews(claim_id,observed_state,operator_id,case_ref) values(a.id,a.state,p_operator_id,p_case_ref) on conflict do nothing;
 get diagnostics v_inserted = row_count;
 return v_inserted=1;
end $$;
revoke all on function public.kits_shadow_schedule_claim_v2(uuid,bigint,uuid,bigint),public.kits_shadow_schedule_unresolved(),public.kits_shadow_claim_review_queue(),public.kits_shadow_claim_review_record(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.kits_shadow_schedule_claim_v2(uuid,bigint,uuid,bigint),public.kits_shadow_schedule_unresolved(),public.kits_shadow_claim_review_queue(),public.kits_shadow_claim_review_record(uuid,text,uuid,text) to service_role;
