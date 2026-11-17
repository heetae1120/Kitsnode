\set ON_ERROR_STOP on
create role anon; create role authenticated; create role service_role;
create schema kitsnode_ads_private;
create table kitsnode_ads_private.connections(id uuid primary key,user_id uuid not null,status text not null,revision bigint not null);
insert into kitsnode_ads_private.connections values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','read_connected',1);
\ir ../../supabase/migrations/20261117065047_shopping_individual_shadow_rules.sql
select public.kits_shopping_shadow_save('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',100,50,1000,100,null,'product','nad-1');
\ir ../../supabase/migrations/20261117113458_shopping_shadow_rank_goals_compat_20261117.sql
do $$
declare saved jsonb; changed jsonb; result uuid;
begin
 if exists(select 1 from kitsnode_ads_private.shopping_shadow_rules where pc_position is not null or mobile_position is not null) then raise exception 'legacy goals changed'; end if;
 if has_function_privilege('anon','public.kits_shopping_shadow_save_rank(uuid,uuid,text,text,integer,integer,integer,integer,bigint,text,text,integer,integer)','execute') or has_function_privilege('authenticated','public.kits_shopping_shadow_save_rank(uuid,uuid,text,text,integer,integer,integer,integer,bigint,text,text,integer,integer)','execute') then raise exception 'public access'; end if;
 saved:=public.kits_shopping_shadow_save_rank('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',100,50,1000,100,0,'product','nad-1',2,3);
 if (saved->>'pc_position')::int<>2 or (saved->>'mobile_position')::int<>3 or (saved->>'version')::int<>1 then raise exception 'upgrade failed %',saved; end if;
 changed:=public.kits_shopping_shadow_save_rank('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',100,50,1000,100,0,'product','nad-1',1,1);
 if changed is not null then raise exception 'stale version saved'; end if;
 changed:=public.kits_shopping_shadow_save_rank('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',100,50,1000,100,1,'product','nad-1',1,1);
 if changed is not null then raise exception 'foreign owner saved'; end if;
 changed:=public.kits_shopping_shadow_save_rank('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',100,50,1000,100,1,'product','nad-1',5,1);
 if changed is not null then raise exception 'invalid rank saved'; end if;
 changed:=public.kits_shopping_shadow_save('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',120,50,1000,100,1,'product','nad-1');
 if changed->>'pc_position' is not null or changed->>'mobile_position' is not null then raise exception 'legacy manual update retained rank goals'; end if;
 saved:=public.kits_shopping_shadow_save_rank('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1',100,50,1000,100,null,'keyword','nkw-1',10,5);
 if (saved->>'pc_position')::int<>10 or (saved->>'mobile_position')::int<>5 then raise exception 'keyword save failed'; end if;
 result:=public.kits_shopping_shadow_append('11111111-1111-4111-8111-111111111111',(saved->>'id')::uuid,0,1,'{"execution":"disabled","rankEstimate":{"pc":{"position":10,"bid":150},"mobile":{"position":5,"bid":300}}}');
 if result is null or not exists(select 1 from public.kits_shopping_shadow_history('11111111-1111-4111-8111-111111111111',(saved->>'id')::uuid) h where h.result->'rankEstimate'->'mobile'->>'bid'='300') then raise exception 'history failed'; end if;
 if exists(select 1 from public.kits_shopping_shadow_history('22222222-2222-4222-8222-222222222222',(saved->>'id')::uuid)) then raise exception 'foreign history exposed'; end if;
end $$;
