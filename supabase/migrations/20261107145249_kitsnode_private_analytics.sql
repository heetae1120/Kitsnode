-- LOCAL DRAFT ONLY: do not apply to a hosted database without explicit approval.
-- Latest cumulative snapshot per random page view. No answers, identity, IP, URL query,
-- user agent, referrer, cookies, or cross-page visitor/session identifier is stored.
create table public.kitsnode_analytics_views (
  origin text not null check (length(origin) <= 255),
  view_id uuid not null,
  page text not null check (page in ('/tools/','/tools/start/','/tools/rankings/','/tools/seo/','/tools/traffic/','/tools/bidding/','/tools/negative-search/','/tools/keywords/','/tools/survey/','/tools/about/','/tools/market/','/tools/consultation/')),
  sequence integer not null check (sequence between 1 and 100000),
  visible_ms integer not null check (visible_ms between 0 and 86400000),
  engaged_ms integer not null check (engaged_ms between 0 and visible_ms),
  reason text not null check (reason in ('heartbeat','hidden','pagehide','navigation','complete')),
  step text check (step in ('brandVision','audience','category','stage','budget','support','brandGoal','contact')),
  last_field text check (last_field in ('brandVision','audience','categoryOther','brandGoal','store','company','nameRole','phone')),
  last_input_ago_ms integer check (last_input_ago_ms between 0 and 86400000),
  completed boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  rate_minute timestamptz not null default date_trunc('minute', now()),
  rate_count integer not null default 1 check (rate_count between 1 and 120),
  primary key (origin, view_id),
  check ((page = '/tools/survey/' and step is not null) or (page <> '/tools/survey/' and step is null and last_field is null and last_input_ago_ms is null and not completed)),
  check ((last_field is null) = (last_input_ago_ms is null)),
  check (not completed or step = 'contact'),
  check (reason <> 'complete' or completed)
);
create index kitsnode_analytics_first_seen on public.kitsnode_analytics_views(first_seen);
create table public.kitsnode_analytics_rate (
  origin text primary key check (length(origin) <= 255),
  minute timestamptz not null,
  requests integer not null check (requests between 1 and 6000)
);
alter table public.kitsnode_analytics_views enable row level security;
alter table public.kitsnode_analytics_rate enable row level security;
revoke all on public.kitsnode_analytics_views, public.kitsnode_analytics_rate from public, anon, authenticated;
grant select, insert, update, delete on public.kitsnode_analytics_views, public.kitsnode_analytics_rate to service_role;

create function public.kitsnode_record_analytics(p_origin text, p_event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.kitsnode_analytics_views%rowtype;
  event_id uuid;
  event_sequence integer;
  event_visible integer;
  event_engaged integer;
  current_minute timestamptz := date_trunc('minute', now());
  rate_count integer;
begin
  -- Exact shape is enforced by the Edge Function before this service-role-only RPC.
  -- Database constraints additionally limit identifiers, durations and completion.
  if p_origin is null or p_origin !~ '^https://[^/]+$' or length(p_origin) > 255
     or p_event->>'version' <> '1' or jsonb_typeof(p_event) <> 'object' then
    return jsonb_build_object('status','invalid_event');
  end if;
  event_id := (p_event->>'viewId')::uuid;
  event_sequence := (p_event->>'sequence')::integer;
  event_visible := (p_event->>'visibleMs')::integer;
  event_engaged := (p_event->>'engagedMs')::integer;
  -- Global, atomic per-origin cap remains effective across Edge isolates.
  insert into public.kitsnode_analytics_rate as r(origin,minute,requests)
    values (p_origin,current_minute,1)
    on conflict (origin) do update set minute = current_minute,
      requests = case when r.minute = current_minute then r.requests + 1 else 1 end
      where r.minute <> current_minute or r.requests < 6000
    returning requests into rate_count;
  if not found then return jsonb_build_object('status','rate_limited'); end if;
  -- Serialize initial inserts as well as updates without retaining another identifier.
  perform pg_advisory_xact_lock(hashtextextended(p_origin || event_id::text, 0));
  select * into current_row from public.kitsnode_analytics_views
    where origin = p_origin and view_id = event_id for update;
  if found then
    if current_row.page <> p_event->>'page' then return jsonb_build_object('status','invalid_event'); end if;
    if current_row.first_seen < now() - interval '24 hours' then return jsonb_build_object('status','expired_view'); end if;
    -- Replays and out-of-order beacons cannot inflate time or extend last_seen.
    if event_sequence <= current_row.sequence then return jsonb_build_object('status','duplicate'); end if;
    if event_visible < current_row.visible_ms or event_engaged < current_row.engaged_ms then return jsonb_build_object('status','invalid_event'); end if;
    if current_row.rate_minute = current_minute and current_row.rate_count >= 120 then return jsonb_build_object('status','rate_limited'); end if;
    update public.kitsnode_analytics_views set
      sequence = event_sequence, visible_ms = event_visible, engaged_ms = event_engaged,
      reason = p_event->>'reason',
      step = case when current_row.completed then 'contact' else p_event->'survey'->>'step' end,
      last_field = p_event->'survey'->>'lastField',
      last_input_ago_ms = (p_event->'survey'->>'lastInputAgoMs')::integer,
      completed = current_row.completed or coalesce((p_event->'survey'->>'completed')::boolean, false),
      last_seen = now(), rate_minute = current_minute,
      rate_count = case when current_row.rate_minute = current_minute then current_row.rate_count + 1 else 1 end
      where origin = p_origin and view_id = event_id;
  else
    insert into public.kitsnode_analytics_views(origin,view_id,page,sequence,visible_ms,engaged_ms,reason,step,last_field,last_input_ago_ms,completed)
      values (p_origin,event_id,p_event->>'page',event_sequence,event_visible,event_engaged,p_event->>'reason',
        p_event->'survey'->>'step',p_event->'survey'->>'lastField',(p_event->'survey'->>'lastInputAgoMs')::integer,
        coalesce((p_event->'survey'->>'completed')::boolean,false));
  end if;
  return jsonb_build_object('status','ok');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then
  return jsonb_build_object('status','invalid_event');
end $$;

create function public.kitsnode_analytics_report(p_days integer default 7)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_days not in (1,7,30) or p_days is null then raise exception 'invalid_days'; end if;
  with recent as (
    select * from public.kitsnode_analytics_views where first_seen >= now() - make_interval(days => p_days)
  ), page_totals as (
    select page, count(*) as views, round(avg(visible_ms)) as visible, round(avg(engaged_ms)) as engaged
      from recent group by page
  ), survey_rows as (
    select *, not completed and last_seen <= now() - interval '30 minutes' as inactive
      from recent where page = '/tools/survey/'
  ), dropoffs as (
    select step,last_field,count(*) as count from survey_rows where inactive group by step,last_field
  )
  select jsonb_build_object(
    'days',p_days,'generatedAt',now(),'abandonmentAfterMinutes',30,
    'pages',coalesce((select jsonb_agg(jsonb_build_object('page',page,'views',views,'avgVisibleMs',visible,'avgEngagedMs',engaged) order by page) from page_totals),'[]'::jsonb),
    'survey',jsonb_build_object(
      'started',(select count(*) from survey_rows),
      'completed',(select count(*) from survey_rows where completed),
      'incomplete',(select count(*) from survey_rows where inactive),
      'pending',(select count(*) from survey_rows where not completed and not inactive),
      'dropoffs',coalesce((select jsonb_agg(jsonb_build_object('step',step,'lastField',last_field,'count',count) order by count desc,step,last_field) from dropoffs),'[]'::jsonb)
    )
  ) into result;
  return result;
end $$;

-- Schedule daily only after approved deployment. Ingestion alone must not be relied
-- on for retention, because an idle service would otherwise retain old rows forever.
create function public.kitsnode_purge_analytics()
returns void language sql security invoker set search_path = '' as $$
  delete from public.kitsnode_analytics_views where first_seen < now() - interval '90 days';
  delete from public.kitsnode_analytics_rate where minute < now() - interval '1 day';
$$;
revoke all on function public.kitsnode_record_analytics(text,jsonb) from public, anon, authenticated;
revoke all on function public.kitsnode_analytics_report(integer) from public, anon, authenticated;
revoke all on function public.kitsnode_purge_analytics() from public, anon, authenticated;
grant execute on function public.kitsnode_record_analytics(text,jsonb) to service_role;
grant execute on function public.kitsnode_analytics_report(integer) to service_role;
grant execute on function public.kitsnode_purge_analytics() to service_role;
