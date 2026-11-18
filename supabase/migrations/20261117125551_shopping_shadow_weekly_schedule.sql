-- Weekly settings are inert data only: no cron, bid change, or provider write.
-- NULL means no schedule is configured; slots are Monday 00 through Sunday 23.
alter table kitsnode_ads_private.shopping_shadow_rules
 add column schedule jsonb,
 add constraint shopping_shadow_schedule_valid check (
  schedule is null or coalesce((jsonb_typeof(schedule)='object'
   and jsonb_typeof(schedule->'timezone')='string'
   and jsonb_typeof(schedule->'slots')='string'
   and schedule->>'timezone'='Asia/Seoul'
   and schedule->>'slots' ~ '^[01]{168}$'
   and schedule = jsonb_build_object('timezone',schedule->>'timezone','slots',schedule->>'slots')),false)
 );

-- Explicit ownership, active connection/revision and rule-version check.
-- Locks are local to the short database transaction; no network call is made.
create function public.kits_shopping_shadow_save_schedule(
 p_user_id uuid, p_connection_id uuid, p_connection_revision bigint,
 p_rule_id uuid, p_expected_version bigint, p_schedule jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r kitsnode_ads_private.shopping_shadow_rules%rowtype;
begin
 if p_schedule is null or not coalesce((jsonb_typeof(p_schedule)='object'
   and jsonb_typeof(p_schedule->'timezone')='string'
   and jsonb_typeof(p_schedule->'slots')='string'
   and p_schedule->>'timezone'='Asia/Seoul'
   and p_schedule->>'slots' ~ '^[01]{168}$'
   and p_schedule=jsonb_build_object('timezone',p_schedule->>'timezone','slots',p_schedule->>'slots')),false)
   or p_expected_version is null or p_expected_version<0 or p_connection_revision is null or p_connection_revision<0
 then return null; end if;
 perform 1 from kitsnode_ads_private.connections
  where id=p_connection_id and user_id=p_user_id and status='read_connected' and revision=p_connection_revision for update;
 if not found then return null; end if;
 update kitsnode_ads_private.shopping_shadow_rules
  set schedule=p_schedule, version=version+1, updated_at=now()
  where id=p_rule_id and connection_id=p_connection_id and version=p_expected_version
  returning * into r;
 if r.id is null then return null; end if;
 return to_jsonb(r);
end $$;
revoke all on function public.kits_shopping_shadow_save_schedule(uuid,uuid,bigint,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.kits_shopping_shadow_save_schedule(uuid,uuid,bigint,uuid,bigint,jsonb) to service_role;
