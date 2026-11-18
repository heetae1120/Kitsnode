\set ON_ERROR_STOP on
\ir rank-goals-db.sql
create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean,deleted_at timestamptz,confirmed_at timestamptz,banned_until timestamptz);
insert into auth.users values('11111111-1111-4111-8111-111111111111',false,null,now(),null);
create table public.kitsnode_member_consents(user_id uuid not null,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(),primary key(user_id,terms_version,privacy_version));
insert into public.kitsnode_member_consents values('11111111-1111-4111-8111-111111111111','2026-11-14','2026-11-14-naver',now());
grant usage on schema kitsnode_ads_private to service_role;
grant select,update on kitsnode_ads_private.connections to service_role;
grant select,update on public.kitsnode_member_consents to service_role;
\ir ../../supabase/migrations/20261117125551_shopping_shadow_weekly_schedule.sql
\ir ../../supabase/migrations/20261117125556_shadow_schedule_claims_inert.sql
do $$
declare rule_id uuid; saved jsonb; claim jsonb; retry jsonb; slot bigint; history_id uuid; count_before integer;
begin
 if has_table_privilege('authenticated','kitsnode_ads_private.shadow_schedule_claims','select') or has_function_privilege('authenticated','public.kits_shadow_schedule_claim(uuid,bigint,uuid,bigint)','execute') then raise exception 'member ledger access'; end if;
 if has_function_privilege('authenticated','kitsnode_ads_private.shadow_account_active_locked(uuid)','execute') or has_function_privilege('anon','kitsnode_ads_private.shadow_account_active_locked(uuid)','execute') or not has_function_privilege('service_role','kitsnode_ads_private.shadow_account_active_locked(uuid)','execute') or has_table_privilege('service_role','auth.users','select') then raise exception 'account helper access'; end if;
 select id into rule_id from kitsnode_ads_private.shopping_shadow_rules where target_type='keyword';
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 saved:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,rule_id,0,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)));
 if saved is null then raise exception 'schedule save failed'; end if;
 if jsonb_array_length(public.kits_shadow_schedule_candidates(slot,1,null)->'items')<>1 then raise exception 'candidate query failed'; end if;
 if public.kits_shadow_schedule_candidates(slot-3600000,1,null)->>'status'<>'clock_mismatch' then raise exception 'clock mismatch not surfaced'; end if;
 if public.kits_shadow_schedule_claim(rule_id,0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot) is not null then raise exception 'stale rule accepted'; end if;
 if public.kits_shadow_schedule_claim(rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot-3600000) is not null then raise exception 'stale hour accepted'; end if;
 claim:=public.kits_shadow_schedule_claim(rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if claim is null then raise exception 'claim failed'; end if;
 retry:=public.kits_shadow_schedule_claim(rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if retry is not null then raise exception 'duplicate claim accepted'; end if;
 if public.kits_shadow_schedule_check((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot)->>'userId' <> '11111111-1111-4111-8111-111111111111' then raise exception 'check owner failed'; end if;
 select count(*) into count_before from kitsnode_ads_private.shopping_shadow_history;
 -- Simulate OFF between claim and append, even if a faulty caller does not
 -- increment version: the final transactional schedule check must reject it.
 update kitsnode_ads_private.shopping_shadow_rules set schedule=jsonb_build_object('timezone','Asia/Seoul','slots',repeat('0',168)) where id=rule_id;
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'append allowed schedule OFF'; end if;
 update kitsnode_ads_private.shopping_shadow_rules set schedule=jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)) where id=rule_id;
 update kitsnode_ads_private.connections set status='revoked' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'append allowed revoked connection'; end if;
 update kitsnode_ads_private.connections set status='read_connected' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 delete from public.kitsnode_member_consents where user_id='11111111-1111-4111-8111-111111111111';
 if public.kits_shadow_schedule_check((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot) is not null then raise exception 'check allowed revoked consent'; end if;
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'append allowed revoked consent'; end if;
 insert into public.kitsnode_member_consents values('11111111-1111-4111-8111-111111111111','2026-11-14','2026-11-14-naver',now());
 update kitsnode_ads_private.connections set revision=2 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'append allowed stale connection'; end if;
 update kitsnode_ads_private.connections set revision=1 where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 update auth.users set banned_until=now()+interval '1 hour' where id='11111111-1111-4111-8111-111111111111';
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'banned account appended'; end if;
 update auth.users set banned_until=null,deleted_at=now() where id='11111111-1111-4111-8111-111111111111';
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'deleted account appended'; end if;
 update auth.users set deleted_at=null where id='11111111-1111-4111-8111-111111111111';
 if (select count(*) from kitsnode_ads_private.shopping_shadow_history)<>count_before then raise exception 'blocked authorization change wrote history'; end if;
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"enabled"}') is not null then raise exception 'append allowed execution'; end if;
 history_id:=public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled","executionMode":"forged"}');
 if history_id is null or not exists(select 1 from kitsnode_ads_private.shopping_shadow_history where id=history_id and result->>'executionMode'='scheduled' and result->'scheduleEvaluation'->>'status'='on') then raise exception 'scheduled append failed'; end if;
 if public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}') is not null then raise exception 'duplicate append accepted'; end if;
 if not public.kits_shadow_schedule_finish((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'recorded',history_id,null) then raise exception 'finish failed'; end if;
 if not public.kits_shadow_schedule_finish((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'recorded',history_id,null) then raise exception 'idempotent finish failed'; end if;
 if public.kits_shadow_schedule_finish((claim->>'claimId')::uuid,rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'uncertain',null,'invalid_simulation_result') then raise exception 'conflicting finish accepted'; end if;
 delete from public.kitsnode_member_consents where user_id='11111111-1111-4111-8111-111111111111';
 if jsonb_array_length(public.kits_shadow_schedule_candidates(slot,1,null)->'items')<>0 then raise exception 'withdrawn consent accepted'; end if;
 if public.kits_shadow_schedule_claim(rule_id,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot) is not null then raise exception 'withdrawn consent claimed'; end if;
end $$;
alter role service_role bypassrls;
insert into public.kitsnode_member_consents values('11111111-1111-4111-8111-111111111111','2026-11-14','2026-11-14-naver',now());
set role service_role;
do $$
declare rule_id uuid; rule_version bigint; saved jsonb; claim jsonb; who jsonb; entry uuid; slot bigint;
begin
 select id,version into rule_id,rule_version from kitsnode_ads_private.shopping_shadow_rules where target_type='product';
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 saved:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,rule_id,rule_version,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)));
 if saved is null then raise exception 'service schedule save failed'; end if;
 rule_version:=(saved->>'version')::bigint;
 who:=public.kits_shadow_schedule_check_rule(rule_id,rule_version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if who->>'userId'<>'11111111-1111-4111-8111-111111111111' or (who->>'connectionRevision')::bigint<>1 then raise exception 'service check rule failed'; end if;
 if public.kits_shadow_schedule_check_rule(rule_id,rule_version-1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot) is not null then raise exception 'stale rule check allowed'; end if;
 claim:=public.kits_shadow_schedule_claim(rule_id,rule_version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if claim is null then raise exception 'service claim failed'; end if;
 who:=public.kits_shadow_schedule_check((claim->>'claimId')::uuid,rule_id,rule_version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if who->>'userId'<>'11111111-1111-4111-8111-111111111111' or (who->>'connectionRevision')::bigint<>1 then raise exception 'service principal failed'; end if;
 entry:=public.kits_shadow_schedule_append((claim->>'claimId')::uuid,rule_id,rule_version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}');
 if entry is null then raise exception 'service append failed'; end if;
 if not public.kits_shadow_schedule_finish((claim->>'claimId')::uuid,rule_id,rule_version,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'recorded',entry,null) then raise exception 'service finish failed'; end if;
end $$;
reset role;
-- More than one page is processed without duplicates or skipping candidates.
insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
select gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-page-'||i,100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)) from generate_series(1,205) i;
do $$
declare slot bigint; p1 jsonb; p2 jsonb; p3 jsonb; all_rows jsonb; total integer; distinct_count integer;
begin
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 p1:=public.kits_shadow_schedule_candidates(slot,100,null);
 p2:=public.kits_shadow_schedule_candidates(slot,100,(p1->>'nextCursor')::uuid);
 p3:=public.kits_shadow_schedule_candidates(slot,100,(p2->>'nextCursor')::uuid);
 if p1->>'status'<>'ok' or p2->>'status'<>'ok' or p3->>'status'<>'ok' or
   jsonb_array_length(p1->'items')<>100 or jsonb_array_length(p2->'items')<>100 or jsonb_array_length(p3->'items')<>7 or
   p1->>'nextCursor' is null or p2->>'nextCursor' is null or p3->>'nextCursor' is not null then raise exception 'candidate pagination failed'; end if;
 all_rows:=(p1->'items')||(p2->'items')||(p3->'items');
 select count(*),count(distinct e->>'id') into total,distinct_count from jsonb_array_elements(all_rows) e;
 if total<>207 or distinct_count<>207 then raise exception 'duplicate or missing page items'; end if;
end $$;
\ir shadow-claim-outcome-monitor-candidate.sql
-- New API must coexist with the legacy function, never grant browser access,
-- distinguish ambiguous claims from recorded duplicates, and never retry.
do $$
declare slot bigint; c jsonb; x jsonb; e uuid;
begin
 if has_function_privilege('authenticated','public.kits_shadow_schedule_claim_v2(uuid,bigint,uuid,bigint)','execute') or
    has_function_privilege('anon','public.kits_shadow_schedule_unresolved()','execute') or
    not has_function_privilege('service_role','public.kits_shadow_schedule_claim_v2(uuid,bigint,uuid,bigint)','execute') then raise exception 'v2 privilege regression'; end if;
 insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
 values('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-v2',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)));
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 c:=public.kits_shadow_schedule_claim_v2('44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if c->>'status'<>'claimed' then raise exception 'v2 failed to claim'; end if;
 x:=public.kits_shadow_schedule_claim_v2('44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'in_progress' then raise exception 'fresh pending claim should be in progress'; end if;
 if public.kits_shadow_schedule_claim('44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot) is not null then raise exception 'legacy compatibility changed'; end if;
 update kitsnode_ads_private.shadow_schedule_claims set created_at=now()-interval '11 minutes' where id=(c->'claim'->>'claimId')::uuid;
 if (public.kits_shadow_schedule_unresolved()->>'staleClaimed')::integer<>1 then raise exception 'stale claim missed'; end if;
 x:=public.kits_shadow_schedule_claim_v2('44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'unresolved' then raise exception 'stale claim not unresolved'; end if;
 e:=public.kits_shadow_schedule_append((c->'claim'->>'claimId')::uuid,'44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'11111111-1111-4111-8111-111111111111',1,'{"status":"shadow_only","execution":"disabled"}');
 if e is null then raise exception 'v2 append failed'; end if;
 x:=public.kits_shadow_schedule_claim_v2('44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'already_recorded' then raise exception 'completed claim not distinguished'; end if;
 if (public.kits_shadow_schedule_unresolved()->>'staleClaimed')::integer<>0 then raise exception 'completed marked stale'; end if;
 x:=public.kits_shadow_schedule_claim_v2('55555555-5555-4555-8555-555555555555',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'rejected' then raise exception 'rejected claim treated as duplicate'; end if;
end $$;
set role service_role;
do $$
declare slot bigint; outcome jsonb;
begin
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 outcome:=public.kits_shadow_schedule_claim_v2('44444444-4444-4444-8444-444444444444',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if outcome->>'status'<>'already_recorded' then raise exception 'service v2 claim unavailable'; end if;
 if (public.kits_shadow_schedule_unresolved()->>'staleClaimed')::integer<>0 then raise exception 'service unresolved unexpected'; end if;
end $$;
reset role;
do $$
declare slot bigint; c jsonb; x jsonb;
begin
 insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
 values ('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-v2-skip',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168))),
        ('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-v2-uncertain',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168))),
        ('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-v2-unexpected-skip',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)));
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 c:=public.kits_shadow_schedule_claim_v2('77777777-7777-4777-8777-777777777777',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if not public.kits_shadow_schedule_finish((c->'claim'->>'claimId')::uuid,'77777777-7777-4777-8777-777777777777',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'skipped',null,'authorization_changed') then raise exception 'skip setup'; end if;
 x:=public.kits_shadow_schedule_claim_v2('77777777-7777-4777-8777-777777777777',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'already_skipped' then raise exception 'intentional skip treated as unresolved'; end if;
 c:=public.kits_shadow_schedule_claim_v2('88888888-8888-4888-8888-888888888888',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if not public.kits_shadow_schedule_finish((c->'claim'->>'claimId')::uuid,'88888888-8888-4888-8888-888888888888',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'uncertain',null,'simulation_or_authorization_failed') then raise exception 'uncertain setup'; end if;
 x:=public.kits_shadow_schedule_claim_v2('88888888-8888-4888-8888-888888888888',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'unresolved' or (public.kits_shadow_schedule_unresolved()->>'uncertain')::integer<>1 then raise exception 'uncertain not monitored'; end if;
 c:=public.kits_shadow_schedule_claim_v2('99999999-9999-4999-8999-999999999999',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if not public.kits_shadow_schedule_finish((c->'claim'->>'claimId')::uuid,'99999999-9999-4999-8999-999999999999',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'skipped',null,'invalid_simulation_result') then raise exception 'unexpected skip setup'; end if;
 x:=public.kits_shadow_schedule_claim_v2('99999999-9999-4999-8999-999999999999',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if x->>'status'<>'unresolved' or (public.kits_shadow_schedule_unresolved()->>'uncertain')::integer<>2 then raise exception 'unexpected skip not monitored'; end if;
end $$;
do $$
declare a kitsnode_ads_private.shadow_schedule_claims%rowtype; slot bigint; c jsonb; before_state text; before_entry uuid;
begin
 if has_table_privilege('authenticated','kitsnode_ads_private.shadow_claim_reviews','select') or has_table_privilege('service_role','kitsnode_ads_private.shadow_claim_reviews','update') or has_table_privilege('service_role','kitsnode_ads_private.shadow_claim_reviews','delete') or has_function_privilege('authenticated','public.kits_shadow_claim_review_record(uuid,text,uuid,text)','execute') then raise exception 'review privileges too broad'; end if;
 select * into a from kitsnode_ads_private.shadow_schedule_claims where rule_id='88888888-8888-4888-8888-888888888888'; before_state:=a.state; before_entry:=a.entry_id;
 if public.kits_shadow_claim_review_record(a.id,'claimed','11111111-1111-4111-8111-111111111111','CASE-123') then raise exception 'wrong state reviewed'; end if;
 if not public.kits_shadow_claim_review_record(a.id,'uncertain','11111111-1111-4111-8111-111111111111','CASE-123') then raise exception 'review record failed'; end if;
 if public.kits_shadow_claim_review_record(a.id,'uncertain','11111111-1111-4111-8111-111111111111','CASE-123') then raise exception 'duplicate review accepted'; end if;
 if not exists(select 1 from kitsnode_ads_private.shadow_claim_reviews where claim_id=a.id and observed_state='uncertain' and operator_id='11111111-1111-4111-8111-111111111111' and case_ref='CASE-123' and reviewed_at is not null) then raise exception 'review audit incomplete'; end if;
 if not exists(select 1 from jsonb_array_elements(public.kits_shadow_claim_review_queue()) q where q->>'claim_id'=a.id::text and (q->>'review_recorded')::boolean) then raise exception 'reviewed unresolved claim hidden from queue'; end if;
 if exists(select 1 from kitsnode_ads_private.shadow_schedule_claims where id=a.id and (state is distinct from before_state or entry_id is distinct from before_entry)) then raise exception 'review mutated claim'; end if;
 if (public.kits_shadow_schedule_unresolved()->>'uncertain')::integer<>2 then raise exception 'review must not suppress unresolved aggregate'; end if;
 if public.kits_shadow_schedule_claim_v2(a.rule_id,a.rule_version,a.connection_id,1000*extract(epoch from a.slot_start)::bigint)->>'status'<>'unresolved' then raise exception 'review must not suppress unresolved claim'; end if;
 insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
 values('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-v2-claim-review',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)));
 slot:=1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600);
 c:=public.kits_shadow_schedule_claim_v2('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot);
 if public.kits_shadow_claim_review_record((c->'claim'->>'claimId')::uuid,'claimed','11111111-1111-4111-8111-111111111111','CASE-123') then raise exception 'fresh claim review accepted'; end if;
 update kitsnode_ads_private.shadow_schedule_claims set created_at=now()-interval '11 minutes' where id=(c->'claim'->>'claimId')::uuid;
 if not public.kits_shadow_claim_review_record((c->'claim'->>'claimId')::uuid,'claimed','11111111-1111-4111-8111-111111111111','CASE-124') then raise exception 'stale claim review failed'; end if;
 if not public.kits_shadow_schedule_finish((c->'claim'->>'claimId')::uuid,'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot,'uncertain',null,'invalid_simulation_result') then raise exception 'late uncertain result failed'; end if;
 if public.kits_shadow_schedule_claim_v2('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slot)->>'status'<>'unresolved' then raise exception 'late new state was suppressed'; end if;
 if (public.kits_shadow_schedule_unresolved()->>'uncertain')::integer<>3 then raise exception 'late state not re-alerted'; end if;
 if public.kits_shadow_claim_review_record((c->'claim'->>'claimId')::uuid,'claimed','11111111-1111-4111-8111-111111111111','CASE-125') then raise exception 'stale expected state accepted'; end if;
end $$;
set role service_role;
do $$
declare a kitsnode_ads_private.shadow_schedule_claims%rowtype; items jsonb;
begin
 items:=public.kits_shadow_claim_review_queue();
 if jsonb_array_length(items)<1 then raise exception 'service review queue failed'; end if;
 select * into a from kitsnode_ads_private.shadow_schedule_claims where rule_id='99999999-9999-4999-8999-999999999999';
 if not public.kits_shadow_claim_review_record(a.id,'skipped','11111111-1111-4111-8111-111111111111','CASE-126') then raise exception 'service review record failed'; end if;
 if not exists(select 1 from kitsnode_ads_private.shadow_claim_reviews where claim_id=a.id and operator_id='11111111-1111-4111-8111-111111111111') then raise exception 'service audit read failed'; end if;
end $$;
reset role;
