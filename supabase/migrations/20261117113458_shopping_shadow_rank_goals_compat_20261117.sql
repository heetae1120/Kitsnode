-- Optional goals preserve existing manual-only rules. No execution or scheduler.
alter table kitsnode_ads_private.shopping_shadow_rules
 add column pc_position integer,
 add column mobile_position integer,
 add constraint shopping_shadow_rank_goals_valid check (
  (pc_position is null and mobile_position is null) or
  (pc_position is not null and mobile_position is not null and
   ((target_type='product' and pc_position between 1 and 4 and mobile_position between 1 and 4) or
    (target_type='keyword' and pc_position between 1 and 10 and mobile_position between 1 and 5)))
 );

-- Old clients save manual rules. Clear earlier rank goals when they update one.
create or replace function public.kits_shopping_shadow_save(p_user_id uuid,p_connection_id uuid,p_campaign_id text,p_adgroup_id text,p_reference_bid integer,p_min_bid integer,p_max_bid integer,p_max_change integer,p_expected_version bigint,p_target_type text,p_target_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype;
begin
 select * into c from kitsnode_ads_private.connections where id=p_connection_id and user_id=p_user_id and status='read_connected' for update;
 if not found then return null; end if;
 if p_expected_version is null then
 if (select count(*) from kitsnode_ads_private.shopping_shadow_rules where connection_id=c.id)>=100 then return null; end if;
 insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,reference_bid,min_bid,max_bid,max_change,target_type,target_id)
 values(gen_random_uuid(),c.id,p_campaign_id,p_adgroup_id,p_reference_bid,p_min_bid,p_max_bid,p_max_change,p_target_type,p_target_id)
 on conflict(connection_id,target_type,target_id) do nothing returning * into r;
 else
 update kitsnode_ads_private.shopping_shadow_rules set campaign_id=p_campaign_id,reference_bid=p_reference_bid,min_bid=p_min_bid,max_bid=p_max_bid,max_change=p_max_change,pc_position=null,mobile_position=null,version=version+1,updated_at=now()
 where connection_id=c.id and adgroup_id=p_adgroup_id and target_type=p_target_type and target_id=p_target_id and version=p_expected_version returning * into r;
 end if;
 if r.id is null then return null; end if;
 return to_jsonb(r);
end $$;

-- The legacy save and new rank update execute within one transaction. Existing
-- connection ownership, row lock and optimistic version checks remain in force.
create function public.kits_shopping_shadow_save_rank(
 p_user_id uuid,p_connection_id uuid,p_campaign_id text,p_adgroup_id text,
 p_reference_bid integer,p_min_bid integer,p_max_bid integer,p_max_change integer,
 p_expected_version bigint,p_target_type text,p_target_id text,
 p_pc_position integer,p_mobile_position integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved jsonb; result jsonb;
begin
 if p_target_type not in ('product','keyword') or p_pc_position is null or p_mobile_position is null or
    (p_target_type='product' and (p_pc_position not between 1 and 4 or p_mobile_position not between 1 and 4)) or
    (p_target_type='keyword' and (p_pc_position not between 1 and 10 or p_mobile_position not between 1 and 5)) then
  return null;
 end if;
 saved := public.kits_shopping_shadow_save(p_user_id,p_connection_id,p_campaign_id,p_adgroup_id,p_reference_bid,p_min_bid,p_max_bid,p_max_change,p_expected_version,p_target_type,p_target_id);
 if saved is null then return null; end if;
 update kitsnode_ads_private.shopping_shadow_rules set pc_position=p_pc_position,mobile_position=p_mobile_position
 where id=(saved->>'id')::uuid and connection_id=p_connection_id returning to_jsonb(shopping_shadow_rules.*) into result;
 if result is null then raise exception 'rank rule update failed'; end if;
 return result;
end $$;
revoke all on function public.kits_shopping_shadow_save_rank(uuid,uuid,text,text,integer,integer,integer,integer,bigint,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.kits_shopping_shadow_save_rank(uuid,uuid,text,text,integer,integer,integer,integer,bigint,text,text,integer,integer) to service_role;
