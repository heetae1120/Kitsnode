create table kitsnode_ads_private.master_report_cooldowns (
 connection_id uuid primary key references kitsnode_ads_private.connections(id),
 last_started_at timestamptz not null
);
alter table kitsnode_ads_private.master_report_cooldowns enable row level security;
revoke all on kitsnode_ads_private.master_report_cooldowns from public, anon, authenticated, service_role;
grant select,insert,update on kitsnode_ads_private.master_report_cooldowns to service_role;
create function public.kits_ads_reserve_master_report(p_user_id uuid, p_connection_id uuid, p_revision bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz:=clock_timestamp();
begin
 if p_user_id is null or p_connection_id is null or p_revision is null then return false; end if;
 if not exists(select 1 from kitsnode_ads_private.connections where id=p_connection_id and user_id=p_user_id and status='read_connected' and revision=p_revision) then return false; end if;
 insert into kitsnode_ads_private.master_report_cooldowns(connection_id,last_started_at) values(p_connection_id,v_now)
 on conflict(connection_id) do update set last_started_at=excluded.last_started_at
 where kitsnode_ads_private.master_report_cooldowns.last_started_at <= v_now-interval '2 minutes';
 return found;
end $$;
revoke all on function public.kits_ads_reserve_master_report(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.kits_ads_reserve_master_report(uuid,uuid,bigint) to service_role;
