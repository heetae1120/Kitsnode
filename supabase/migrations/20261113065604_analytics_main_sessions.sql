-- Only finite attribution categories and an ephemeral per-tab random ID are stored.
create table public.kitsnode_main_sessions (
  session_id uuid primary key,
  origin text not null check (origin = 'https://heetae1120.github.io'),
  started_at timestamptz not null default now(),
  source text not null check (source in ('google','naver','daum','bing','yahoo','duckduckgo','youtube','instagram','facebook','kakao','x','linkedin','newsletter','other_referral','direct_or_unknown','other_tagged')),
  medium text not null check (medium in ('organic','social','referral','email','paid_search','paid_social','display','direct_or_unknown','other_tagged')),
  campaign text not null check (campaign in ('none','other_tagged'))
);
alter table public.kitsnode_main_sessions enable row level security;
revoke all on public.kitsnode_main_sessions from public, anon, authenticated;
grant select, insert, delete on public.kitsnode_main_sessions to service_role;
create index kitsnode_main_sessions_started_idx on public.kitsnode_main_sessions(started_at);

create function public.kitsnode_record_main_session(p_origin text, p_event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare n integer; id uuid; a jsonb := p_event->'attribution'; current_minute timestamptz := date_trunc('minute',now());
begin
  if p_origin <> 'https://heetae1120.github.io' or p_event->>'version' <> '1' or p_event->>'landing' <> 'main' or
     jsonb_typeof(p_event) <> 'object' or (p_event - array['version','sessionId','landing','attribution']) <> '{}'::jsonb or
     jsonb_typeof(a) <> 'object' or (a - array['source','medium','campaign','basis']) <> '{}'::jsonb or
     not (a ?& array['source','medium','campaign','basis']) or a->>'basis' not in ('utm','referrer','unknown')
     or p_event->>'sessionId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('status','invalid_event');
  end if;
  id := (p_event->>'sessionId')::uuid;
  insert into public.kitsnode_analytics_rate as r(origin,minute,requests) values (p_origin,current_minute,1)
    on conflict (origin) do update set minute=current_minute, requests=case when r.minute=current_minute then r.requests+1 else 1 end
    where r.minute<>current_minute or r.requests<6000 returning requests into n;
  if not found then return jsonb_build_object('status','rate_limited'); end if;
  insert into public.kitsnode_main_sessions(session_id,origin,source,medium,campaign)
    values(id,p_origin,a->>'source',a->>'medium',a->>'campaign') on conflict(session_id) do nothing;
  return jsonb_build_object('status','ok');
exception when invalid_text_representation or check_violation or not_null_violation then return jsonb_build_object('status','invalid_event');
end $$;

create function public.kitsnode_main_session_report(p_days integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_days is null or p_days not in (1,7,30) then raise exception 'invalid_days'; end if;
  with recent as (select * from public.kitsnode_main_sessions where started_at >= now()-make_interval(days=>p_days)),
  grouped as (select (started_at at time zone 'Asia/Seoul')::date as day,source,medium,campaign,count(*) as sessions from recent group by 1,2,3,4)
  select jsonb_build_object('landing','main',
    'rows',coalesce((select jsonb_agg(jsonb_build_object('date',day,'source',source,'medium',medium,'campaign',campaign,'sessions',sessions) order by day,source,medium,campaign) from grouped),'[]'::jsonb)) into result;
  return result;
end $$;

create or replace function public.kitsnode_purge_analytics() returns void language sql security invoker set search_path = '' as $$
  delete from public.kitsnode_analytics_views where first_seen < now()-interval '90 days';
  delete from public.kitsnode_analytics_rate where minute < now()-interval '1 day';
  delete from public.kitsnode_main_sessions where started_at < now()-interval '90 days';
$$;
revoke all on function public.kitsnode_record_main_session(text,jsonb) from public,anon,authenticated;
revoke all on function public.kitsnode_main_session_report(integer) from public,anon,authenticated;
grant execute on function public.kitsnode_record_main_session(text,jsonb) to service_role;
grant execute on function public.kitsnode_main_session_report(integer) to service_role;
