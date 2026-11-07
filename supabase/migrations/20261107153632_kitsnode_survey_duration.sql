-- LOCAL DRAFT ONLY. Existing v1 migration is already installed; do not rewrite it.
-- No hosted DB, deployment, collection enablement, or backfill is authorized here.
-- Unknown historical timing stays NULL. Timing has no answer or identity values.
alter table public.kitsnode_analytics_views
  add column survey_elapsed_ms integer,
  add column survey_visible_ms integer,
  add column survey_engaged_ms integer,
  add constraint kitsnode_survey_timing_bounds check (
    (survey_elapsed_ms is null and survey_visible_ms is null and survey_engaged_ms is null)
    or
    (page = '/tools/survey/' and survey_elapsed_ms is not null and survey_visible_ms is not null and survey_engaged_ms is not null
      and survey_elapsed_ms between 0 and 86400000
      and survey_visible_ms between 0 and survey_elapsed_ms
      and survey_engaged_ms between 0 and survey_visible_ms
      and survey_visible_ms <= visible_ms and survey_engaged_ms <= engaged_ms)
  );

create or replace function public.kitsnode_record_analytics(p_origin text, p_event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.kitsnode_analytics_views%rowtype;
  event_id uuid;
  event_sequence integer;
  event_visible integer;
  event_engaged integer;
  event_elapsed integer;
  survey_visible integer;
  survey_engaged integer;
  current_minute timestamptz := date_trunc('minute', now());
  rate_count integer;
begin
  -- Exact shape is enforced by the Edge Function before this service-role-only RPC.
  -- Database constraints additionally limit identifiers, durations and completion.
  if p_origin is null or p_origin !~ '^https://[^/]+$' or length(p_origin) > 255
     or coalesce(p_event->>'version','') not in ('1','2') or jsonb_typeof(p_event) <> 'object' then
    return jsonb_build_object('status','invalid_event');
  end if;
  event_id := (p_event->>'viewId')::uuid;
  event_sequence := (p_event->>'sequence')::integer;
  event_visible := (p_event->>'visibleMs')::integer;
  event_engaged := (p_event->>'engagedMs')::integer;
  if p_event->>'version' = '2' then
    event_elapsed := (p_event->'survey'->'timing'->>'elapsedMs')::integer;
    survey_visible := (p_event->'survey'->'timing'->>'visibleMs')::integer;
    survey_engaged := (p_event->'survey'->'timing'->>'engagedMs')::integer;
  end if;
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
    -- Measured in-progress durations cannot regress or disappear. Once complete,
    -- freeze the first confirmed measurement (including unknown legacy timing).
    if not current_row.completed and current_row.survey_elapsed_ms is not null and
       (event_elapsed is null or event_elapsed < current_row.survey_elapsed_ms or
        survey_visible < current_row.survey_visible_ms or survey_engaged < current_row.survey_engaged_ms) then
      return jsonb_build_object('status','invalid_event');
    end if;
    if current_row.rate_minute = current_minute and current_row.rate_count >= 120 then return jsonb_build_object('status','rate_limited'); end if;
    update public.kitsnode_analytics_views set
      sequence = event_sequence, visible_ms = event_visible, engaged_ms = event_engaged,
      reason = p_event->>'reason',
      survey_elapsed_ms = case when current_row.completed then current_row.survey_elapsed_ms else event_elapsed end,
      survey_visible_ms = case when current_row.completed then current_row.survey_visible_ms else survey_visible end,
      survey_engaged_ms = case when current_row.completed then current_row.survey_engaged_ms else survey_engaged end,
      step = case when current_row.completed then 'contact' else p_event->'survey'->>'step' end,
      last_field = p_event->'survey'->>'lastField',
      last_input_ago_ms = (p_event->'survey'->>'lastInputAgoMs')::integer,
      completed = current_row.completed or coalesce((p_event->'survey'->>'completed')::boolean, false),
      last_seen = now(), rate_minute = current_minute,
      rate_count = case when current_row.rate_minute = current_minute then current_row.rate_count + 1 else 1 end
      where origin = p_origin and view_id = event_id;
  else
    insert into public.kitsnode_analytics_views(origin,view_id,page,sequence,visible_ms,engaged_ms,reason,step,last_field,last_input_ago_ms,completed,survey_elapsed_ms,survey_visible_ms,survey_engaged_ms)
      values (p_origin,event_id,p_event->>'page',event_sequence,event_visible,event_engaged,p_event->>'reason',
        p_event->'survey'->>'step',p_event->'survey'->>'lastField',(p_event->'survey'->>'lastInputAgoMs')::integer,
        coalesce((p_event->'survey'->>'completed')::boolean,false),event_elapsed,survey_visible,survey_engaged);
  end if;
  return jsonb_build_object('status','ok');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then
  return jsonb_build_object('status','invalid_event');
end $$;

create or replace function public.kitsnode_analytics_report(p_days integer default 7)
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
  ), timing_groups as (
    select status,
      count(survey_visible_ms) as samples,
      round(avg(survey_elapsed_ms)) as elapsed,
      round(avg(survey_visible_ms)) as visible,
      round(avg(survey_engaged_ms)) as engaged,
      percentile_cont(0.5) within group (order by survey_visible_ms) as median
    from (select *, case when completed then 'completed' when inactive then 'incomplete' else 'pending' end as status from survey_rows) classified
    group by status
  ), timing as (
    select jsonb_object_agg(status,jsonb_build_object('samples',coalesce(samples,0),
      'avgElapsedMs',elapsed,'avgVisibleMs',visible,'avgEngagedMs',engaged,'medianVisibleMs',median)) as value
    from (values ('completed'),('incomplete'),('pending')) states(status)
    left join timing_groups using(status)
  ), dropoffs as (
    select step,last_field,count(*) as count from survey_rows where inactive group by step,last_field
  )
  select jsonb_build_object(
    'days',p_days,'generatedAt',now(),'abandonmentAfterMinutes',30,
    'pages',coalesce((select jsonb_agg(jsonb_build_object('page',page,'views',views,'avgVisibleMs',visible,'avgEngagedMs',engaged) order by page) from page_totals),'[]'::jsonb),
    'survey',jsonb_build_object(
      'timing',(select value from timing),
      'started',(select count(*) from survey_rows),
      'completed',(select count(*) from survey_rows where completed),
      'incomplete',(select count(*) from survey_rows where inactive),
      'pending',(select count(*) from survey_rows where not completed and not inactive),
      'dropoffs',coalesce((select jsonb_agg(jsonb_build_object('step',step,'lastField',last_field,'count',count) order by count desc,step,last_field) from dropoffs),'[]'::jsonb)
    )
  ) into result;
  return result;
end $$;

-- Replacing functions retains privileges; restate the private RPC boundary explicitly.
revoke all on function public.kitsnode_record_analytics(text,jsonb) from public, anon, authenticated;
revoke all on function public.kitsnode_analytics_report(integer) from public, anon, authenticated;
grant execute on function public.kitsnode_record_analytics(text,jsonb) to service_role;
grant execute on function public.kitsnode_analytics_report(integer) to service_role;
