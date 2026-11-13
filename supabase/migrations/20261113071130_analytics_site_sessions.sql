-- Legacy main-only sessions remain separate from site-wide sessions.
alter table public.kitsnode_main_sessions add column scope text not null default 'main' check (scope in ('main','site'));

create or replace function public.kitsnode_record_main_session(p_origin text, p_event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare n integer; id uuid; a jsonb := p_event->'attribution'; current_minute timestamptz := date_trunc('minute',now());
begin
  if p_origin <> 'https://heetae1120.github.io' or p_event->>'version' <> '1' or p_event->>'landing' not in ('main','site') or
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
  insert into public.kitsnode_main_sessions(session_id,origin,source,medium,campaign,scope)
    values(id,p_origin,a->>'source',a->>'medium',a->>'campaign',p_event->>'landing') on conflict(session_id) do nothing;
  return jsonb_build_object('status','ok');
exception when invalid_text_representation or check_violation or not_null_violation then return jsonb_build_object('status','invalid_event');
end $$;

create or replace function public.kitsnode_main_session_report(p_days integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_days is null or p_days not in (1,7,30) then raise exception 'invalid_days'; end if;
  with recent as (select * from public.kitsnode_main_sessions where scope='site' and started_at >= now()-make_interval(days=>p_days)),
  grouped as (select (started_at at time zone 'Asia/Seoul')::date as day,source,medium,campaign,count(*) as sessions from recent group by 1,2,3,4)
  select jsonb_build_object('landing','site',
    'rows',coalesce((select jsonb_agg(jsonb_build_object('date',day,'source',source,'medium',medium,'campaign',campaign,'sessions',sessions) order by day,source,medium,campaign) from grouped),'[]'::jsonb)) into result;
  return result;
end $$;

