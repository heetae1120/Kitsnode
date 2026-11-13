-- Daily totals contain no per-request identifier, path, referrer, or user agent.
create table public.kitsnode_basic_daily (
  day date primary key,
  loads bigint not null default 0 check (loads >= 0 and loads <= 1000000000)
);
alter table public.kitsnode_basic_daily enable row level security;
revoke all on public.kitsnode_basic_daily from public, anon, authenticated;
grant select, insert, update, delete on public.kitsnode_basic_daily to service_role;
create function public.kitsnode_record_basic_load(p_origin text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare n integer; minute_now timestamptz := date_trunc('minute',now());
begin
  if p_origin is distinct from 'https://heetae1120.github.io' then return jsonb_build_object('status','invalid_event'); end if;
  insert into public.kitsnode_analytics_rate as r(origin,minute,requests) values (p_origin,minute_now,1)
    on conflict(origin) do update set minute=minute_now,requests=case when r.minute=minute_now then r.requests+1 else 1 end
    where r.minute<>minute_now or r.requests<6000 returning requests into n;
  if not found then return jsonb_build_object('status','rate_limited'); end if;
  insert into public.kitsnode_basic_daily as d(day,loads) values ((now() at time zone 'Asia/Seoul')::date,1)
    on conflict(day) do update set loads=d.loads+1 where d.loads<1000000000;
  return jsonb_build_object('status','ok');
end $$;
create function public.kitsnode_basic_load_report(p_days integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_days is null or p_days not in (1,7,30) then raise exception 'invalid_days'; end if;
  select jsonb_build_object('timezone','Asia/Seoul','days',p_days,
    'rows',coalesce(jsonb_agg(jsonb_build_object('date',day,'loads',loads) order by day),'[]'::jsonb))
    into result from public.kitsnode_basic_daily where day between today-(p_days-1) and today;
  return result;
end $$;
create or replace function public.kitsnode_purge_analytics() returns void language sql security invoker set search_path = '' as $$
  delete from public.kitsnode_analytics_views where first_seen < now()-interval '90 days';
  delete from public.kitsnode_analytics_rate where minute < now()-interval '1 day';
  delete from public.kitsnode_main_sessions where started_at < now()-interval '90 days';
  delete from public.kitsnode_basic_daily where day <= (now() at time zone 'Asia/Seoul')::date - 90;
$$;
revoke all on function public.kitsnode_record_basic_load(text) from public,anon,authenticated;
revoke all on function public.kitsnode_basic_load_report(integer) from public,anon,authenticated;
grant execute on function public.kitsnode_record_basic_load(text) to service_role;
grant execute on function public.kitsnode_basic_load_report(integer) to service_role;
