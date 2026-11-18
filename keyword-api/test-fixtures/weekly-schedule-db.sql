\set ON_ERROR_STOP on
\ir rank-goals-db.sql
\ir ../../supabase/migrations/20261117125551_shopping_shadow_weekly_schedule.sql
do $$
declare r kitsnode_ads_private.shopping_shadow_rules%rowtype; x jsonb; schedule jsonb:=jsonb_build_object('timezone','Asia/Seoul','slots',repeat('0',168));
begin
 select * into r from kitsnode_ads_private.shopping_shadow_rules where target_type='keyword';
 if r.schedule is not null then raise exception 'legacy schedule changed'; end if;
 if has_function_privilege('anon','public.kits_shopping_shadow_save_schedule(uuid,uuid,bigint,uuid,bigint,jsonb)','execute') or has_function_privilege('authenticated','public.kits_shopping_shadow_save_schedule(uuid,uuid,bigint,uuid,bigint,jsonb)','execute') then raise exception 'public RPC execute'; end if;
 x:=public.kits_shopping_shadow_save_schedule('22222222-2222-4222-8222-222222222222',r.connection_id,1,r.id,r.version,schedule);
 if x is not null then raise exception 'foreign owner accepted'; end if;
 x:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111',r.connection_id,9,r.id,r.version,schedule);
 if x is not null then raise exception 'stale connection accepted'; end if;
 x:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111',r.connection_id,1,r.id,r.version+1,schedule);
 if x is not null then raise exception 'stale version accepted'; end if;
 x:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111',r.connection_id,1,r.id,r.version,'{"timezone":"Asia/Seoul","slots":"1"}');
 if x is not null then raise exception 'invalid schedule accepted'; end if;
 x:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111',r.connection_id,1,r.id,r.version,schedule||'{"extra":true}'::jsonb);
 if x is not null then raise exception 'extra schedule fields accepted'; end if;
 x:=public.kits_shopping_shadow_save_schedule('11111111-1111-4111-8111-111111111111',r.connection_id,1,r.id,r.version,schedule);
 if x is null or x->'schedule'<>schedule or (x->>'version')::bigint<>r.version+1 then raise exception 'schedule save failed'; end if;
 if (select s.schedule from kitsnode_ads_private.shopping_shadow_rules s where s.id=r.id)<>schedule then raise exception 'schedule persistence failed'; end if;
 x:=public.kits_shopping_shadow_save_rank('11111111-1111-4111-8111-111111111111',r.connection_id,r.campaign_id,r.adgroup_id,r.reference_bid,r.min_bid,r.max_bid,r.max_change,r.version+1,r.target_type,r.target_id,r.pc_position,r.mobile_position);
 if x is null or x->'schedule'<>schedule then raise exception 'rank save erased schedule'; end if;
 x:=public.kits_shopping_shadow_save('11111111-1111-4111-8111-111111111111',r.connection_id,r.campaign_id,r.adgroup_id,r.reference_bid,r.min_bid,r.max_bid,r.max_change,r.version+2,r.target_type,r.target_id);
 if x is null or x->'schedule'<>schedule then raise exception 'old client erased schedule'; end if;
end $$;
