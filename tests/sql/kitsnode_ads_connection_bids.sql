\set ON_ERROR_STOP on
-- Run only in a disposable local database, never a hosted project.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
\ir ../../supabase/migrations/20261117022844_kitsnode_ads_connection_bids.sql
insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2647636');
set role authenticated;
do $$ begin
 begin perform public.kits_ads_request('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','123'); raise exception 'authenticated unexpectedly invoked service RPC'; exception when insufficient_privilege then null; end;
 begin perform * from kitsnode_ads_private.connections; raise exception 'authenticated unexpectedly read private table'; exception when insufficient_privilege then null; end;
 begin perform public.kits_ads_review_queue(); raise exception 'authenticated unexpectedly read review queue'; exception when insufficient_privilege then null; end;
 begin perform public.kits_ads_evidence_record('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','contract_review','case-123'); raise exception 'authenticated unexpectedly recorded evidence'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ begin
 if public.kits_ads_request('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','98765') <> 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid then raise exception 'request ID not persisted'; end if;
 if not exists(select 1 from public.kits_ads_review('cccccccc-cccc-4ccc-8ccc-cccccccccccc') where user_id='11111111-1111-4111-8111-111111111111' and ad_account_id='98765' and status='pending_review') then raise exception 'review metadata missing'; end if;
 begin perform public.kits_ads_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','98765'); raise exception 'duplicate user request accepted'; exception when unique_violation then null; end;
 perform public.kits_ads_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','98765');
 if public.kits_ads_approve('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','98765',0,'99999','MASTER','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999') then raise exception 'approval without evidence'; end if;
 if not public.kits_ads_evidence_record('99999999-9999-4999-8999-999999999999','cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','contract_review','case-123') then raise exception 'evidence record failed'; end if;
 if not public.kits_ads_evidence_record('88888888-8888-4888-8888-888888888888','dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','contract_review','case-456') then raise exception 'second evidence record failed'; end if;
 if public.kits_ads_approve('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','98765',0,'99999','MASTER','22222222-2222-4222-8222-222222222222','88888888-8888-4888-8888-888888888888') then raise exception 'wrong request evidence accepted'; end if;
 update kitsnode_ads_private.ownership_evidence set expires_at=now()-interval '1 second' where id='88888888-8888-4888-8888-888888888888';
 if public.kits_ads_approve('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','98765',0,'99999','MASTER','22222222-2222-4222-8222-222222222222','88888888-8888-4888-8888-888888888888') then raise exception 'expired evidence accepted'; end if;
 update kitsnode_ads_private.ownership_evidence set expires_at=now()+interval '1 day' where id='88888888-8888-4888-8888-888888888888';
 if not public.kits_ads_approve('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','98765',0,'99999','MASTER','22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999') then raise exception 'first account approval failed'; end if;
 if public.kits_ads_approve('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','98765',0,'99999','MASTER','22222222-2222-4222-8222-222222222222','88888888-8888-4888-8888-888888888888') then raise exception 'duplicate account approval accepted'; end if;
 if not public.kits_ads_evidence_revoke('cccccccc-cccc-4ccc-8ccc-cccccccccccc','99999999-9999-4999-8999-999999999999','22222222-2222-4222-8222-222222222222') then raise exception 'revoke failed'; end if;
 if exists(select 1 from public.kits_ads_review('cccccccc-cccc-4ccc-8ccc-cccccccccccc') where status<>'disconnected') then raise exception 'revocation did not disconnect'; end if;
 if not public.kits_ads_evidence_record('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','advertiser_confirmation','case-789') then raise exception 'main evidence record failed'; end if;
 if public.kits_ads_approve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2647636',1,'4563552','MASTER','22222222-2222-4222-8222-222222222222','proof-1') then raise exception 'stale approval succeeded'; end if;
 if not public.kits_ads_approve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','2647636',0,'4563552','MASTER','22222222-2222-4222-8222-222222222222','77777777-7777-4777-8777-777777777777') then raise exception 'valid approval failed'; end if;
 if exists(select 1 from public.kits_ads_list('22222222-2222-4222-8222-222222222222') where request_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'cross owner listing'; end if;
 if exists(select 1 from public.kits_ads_get_binding('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222')) then raise exception 'cross owner binding'; end if;
 if not exists(select 1 from public.kits_ads_get_binding('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111') where customer_id='4563552' and naver_role='MASTER') then raise exception 'verified owner binding missing'; end if;
 if public.kits_ads_disconnect('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'cross owner revoke'; end if;
end $$;
do $$ declare i integer; begin
 for i in 1..20 loop if not public.kits_ads_rate_limit('11111111-1111-4111-8111-111111111111') then raise exception 'rate denied early'; end if; end loop;
 if public.kits_ads_rate_limit('11111111-1111-4111-8111-111111111111') then raise exception 'rate limit exceeded'; end if;
 if not public.kits_ads_rate_limit('22222222-2222-4222-8222-222222222222') then raise exception 'per-user rates mixed'; end if;
 if public.kits_ads_rate_limit(null) then raise exception 'null principal accepted'; end if;
end $$;
reset role;
update kitsnode_ads_private.connections set write_verified=true where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role service_role;
do $$ declare x jsonb; begin
 x:=public.kits_ads_save_rule('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'nkw-test','PC',3,100,1000,100,10,300);
 if x is not null then raise exception 'cross-user rule creation'; end if;
 x:=public.kits_ads_save_rule('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'nkw-test','PC',3,60,1000,100,10,300);
 if x is not null then raise exception 'unsafe minimum accepted'; end if;
 x:=public.kits_ads_save_rule('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'nkw-test','PC',3,100,100010,100,10,300);
 if x is not null then raise exception 'unsafe maximum accepted'; end if;
 x:=public.kits_ads_save_rule('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'nkw-test','PC',3,100,1000,100,10,300);
 if x is null or (x->>'version')::int<>0 or (x->>'enabled')::boolean then raise exception 'initial rule not safely disabled'; end if;
 if public.kits_ads_set_rule_enabled('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,true) is not null then raise exception 'enable without CAS'; end if;
 if public.kits_ads_set_rule_enabled('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,false) is not null then raise exception 'cross-user pause'; end if;
 if public.kits_ads_set_rule_enabled('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,false) is not null then raise exception 'stale version pause'; end if;
end $$;
reset role;
update kitsnode_ads_private.execution_capability set atomic_update_verified=true;
set role service_role;
do $$ declare a uuid; x jsonb; begin
 x:=public.kits_ads_set_rule_enabled('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,true);
 if x is null or (x->>'version')::int<>1 then raise exception 'rule enable failed'; end if;
 a:=(public.kits_ads_claim('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111')->>'attemptId')::uuid;
 if a is null then raise exception 'claim failed'; end if;
 if public.kits_ads_save_rule('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'nkw-test','PC',3,100,1000,100,10,300) is not null then raise exception 'edit during active claim'; end if;
 x:=public.kits_ads_set_rule_enabled('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,false);
 if x is null or (x->>'enabled')::boolean then raise exception 'pause failed'; end if;
 if public.kits_ads_mark_sending(a,1,500,600) then raise exception 'pause did not stop claim'; end if;
 if not public.kits_ads_finish(a,'rejected','paused') then raise exception 'failed to close cancelled claim'; end if;
 x:=public.kits_ads_set_rule_enabled('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,true);
 if x is null then raise exception 'resume failed'; end if;
 a:=(public.kits_ads_claim('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111')->>'attemptId')::uuid;
 if a is null then raise exception 'resume claim failed'; end if;
 if public.kits_ads_mark_sending(a,3,500,700) then raise exception 'over-limit intent accepted'; end if;
 if not public.kits_ads_mark_sending(a,3,500,600) then raise exception 'valid intent rejected'; end if;
 if public.kits_ads_finish(a,'rejected','error') then raise exception 'sent attempt incorrectly released'; end if;
 if not public.kits_ads_finish(a,'uncertain','timeout') then raise exception 'uncertain not recorded'; end if;
 if public.kits_ads_finish(a,'applied',null) then raise exception 'uncertain attempt improperly changed'; end if;
end $$;
reset role;
update kitsnode_ads_private.rules set next_run_at=now()-interval '1 hour';
set role service_role;
do $$ begin
 if public.kits_ads_claim('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111') is not null then raise exception 'uncertain target not locked'; end if;
 if not public.kits_ads_disconnect('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'disconnect failed'; end if;
 if exists(select 1 from kitsnode_ads_private.rules where enabled) then raise exception 'disconnect did not disable rules'; end if;
end $$;
reset role;
