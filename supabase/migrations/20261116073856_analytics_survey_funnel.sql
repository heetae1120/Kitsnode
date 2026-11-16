-- Bounded metadata only. No answers, names, contact data, full URLs or IPs.
create table public.kitsnode_survey_attempts (
  attempt_id uuid primary key,
  origin text not null check (origin = 'https://heetae1120.github.io'),
  sequence integer not null check (sequence between 1 and 100000),
  reached text[] not null check (cardinality(reached) between 1 and 8 and reached <@ array['brandVision','audience','category','stage','budget','support','brandGoal','contact']::text[]),
  step text not null check (step = any(reached)),
  status text not null check (status in ('active','left','completed')),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  check (status <> 'completed' or step = 'contact')
);
alter table public.kitsnode_survey_attempts enable row level security;
revoke all on public.kitsnode_survey_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.kitsnode_survey_attempts to service_role;
create index kitsnode_survey_attempts_started_idx on public.kitsnode_survey_attempts(started_at);

create function public.kitsnode_record_survey_funnel(p_origin text,p_event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare id uuid; seq integer; n integer; current_minute timestamptz:=date_trunc('minute',now()); steps text[]; item jsonb;
begin
  if p_origin is distinct from 'https://heetae1120.github.io' or jsonb_typeof(p_event) is distinct from 'object'
     or (p_event - array['version','attemptId','sequence','reached','step','status']) <> '{}'::jsonb
     or not (p_event ?& array['version','attemptId','sequence','reached','step','status'])
     or coalesce(p_event->>'version','') <> '1' or coalesce(p_event->>'attemptId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or coalesce(p_event->>'sequence','') !~ '^[1-9][0-9]{0,5}$' or (p_event->>'sequence')::integer > 100000
     or jsonb_typeof(p_event->'reached') is distinct from 'array' or jsonb_array_length(p_event->'reached') not between 1 and 8
     or coalesce(p_event->>'status','') not in ('active','left','completed') then return jsonb_build_object('status','invalid_event'); end if;
  select array_agg(value #>> '{}') into steps from jsonb_array_elements(p_event->'reached') item(value) where jsonb_typeof(value)='string';
  if cardinality(steps) is distinct from jsonb_array_length(p_event->'reached') or not (steps <@ array['brandVision','audience','category','stage','budget','support','brandGoal','contact']::text[])
     or (select count(distinct x) from unnest(steps) x) <> cardinality(steps)
     or not coalesce((p_event->>'step') = any(steps),false) or (p_event->>'status'='completed' and p_event->>'step'<>'contact') then return jsonb_build_object('status','invalid_event'); end if;
  id:=(p_event->>'attemptId')::uuid; seq:=(p_event->>'sequence')::integer;
  insert into public.kitsnode_analytics_rate as r(origin,minute,requests) values(p_origin,current_minute,1)
    on conflict(origin) do update set minute=current_minute,requests=case when r.minute=current_minute then r.requests+1 else 1 end
    where r.minute<>current_minute or r.requests<6000 returning requests into n;
  if not found then return jsonb_build_object('status','rate_limited'); end if;
  perform pg_advisory_xact_lock(hashtextextended('survey:'||id::text,0));
  if exists(select 1 from public.kitsnode_survey_attempts where attempt_id=id and (sequence>=seq or status='completed')) then return jsonb_build_object('status','duplicate'); end if;
  insert into public.kitsnode_survey_attempts as a(attempt_id,origin,sequence,reached,step,status)
    values(id,p_origin,seq,steps,p_event->>'step',p_event->>'status')
    on conflict(attempt_id) do update set sequence=excluded.sequence,
      reached=(select array_agg(x order by array_position(array['brandVision','audience','category','stage','budget','support','brandGoal','contact']::text[],x)) from (select distinct unnest(a.reached||excluded.reached) as x) unique_steps),
      step=excluded.step,status=excluded.status,last_activity_at=case when excluded.status in ('active','completed') then now() else a.last_activity_at end;
  return jsonb_build_object('status','ok');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then return jsonb_build_object('status','invalid_event');
end $$;

create function public.kitsnode_survey_funnel_report(p_days integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_days is null or p_days not in (1,7,30) then raise exception 'invalid_days'; end if;
  with recent as (select *, (status='left' or (status='active' and last_activity_at <= now()-interval '30 minutes')) as abandoned from public.kitsnode_survey_attempts where started_at >= now()-make_interval(days=>p_days)),
  steps(step,position) as (select * from unnest(array['brandVision','audience','category','stage','budget','support','brandGoal','contact']::text[]) with ordinality),
  counts as (select s.step,s.position,count(r.attempt_id) filter(where s.step=any(r.reached)) as reached,count(r.attempt_id) filter(where r.step=s.step and r.abandoned) as abandoned from steps s left join recent r on true group by s.step,s.position)
  select jsonb_build_object('version',1,'started',(select count(*) from recent),'completed',(select count(*) from recent where status='completed'),
    'abandoned',(select count(*) from recent where abandoned),'active',(select count(*) from recent where status='active' and not abandoned),
    'steps',(select jsonb_agg(jsonb_build_object('step',step,'reached',reached,'abandoned',abandoned) order by position) from counts)) into result;
  return result;
end $$;
create or replace function public.kitsnode_purge_analytics() returns void language sql security invoker set search_path = '' as $$
  delete from public.kitsnode_analytics_views where first_seen < now()-interval '90 days';
  delete from public.kitsnode_analytics_rate where minute < now()-interval '1 day';
  delete from public.kitsnode_main_sessions where started_at < now()-interval '90 days';
  delete from public.kitsnode_basic_daily where day <= (now() at time zone 'Asia/Seoul')::date - 90;
  delete from public.kitsnode_survey_attempts where started_at < now()-interval '90 days';
$$;
revoke all on function public.kitsnode_record_survey_funnel(text,jsonb) from public,anon,authenticated;
revoke all on function public.kitsnode_survey_funnel_report(integer) from public,anon,authenticated;
grant execute on function public.kitsnode_record_survey_funnel(text,jsonb) to service_role;
grant execute on function public.kitsnode_survey_funnel_report(integer) to service_role;
