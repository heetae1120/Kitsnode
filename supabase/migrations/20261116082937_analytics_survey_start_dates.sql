-- Cohorts use each survey's KST start date; abandonment is its current status.
create or replace function public.kitsnode_survey_funnel_report(p_days integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_days is null or p_days not in (1,7,30) then raise exception 'invalid_days'; end if;
  with recent as (
    select *, (started_at at time zone 'Asia/Seoul')::date as day,
      (status='left' or (status='active' and last_activity_at <= now()-interval '30 minutes')) as abandoned
    from public.kitsnode_survey_attempts where started_at >= now()-make_interval(days=>p_days)
  ),
  steps(step,position) as (select * from unnest(array['brandVision','audience','category','stage','budget','support','brandGoal','contact']::text[]) with ordinality),
  counts as (select s.step,s.position,count(r.attempt_id) filter(where s.step=any(r.reached)) as reached,count(r.attempt_id) filter(where r.step=s.step and r.abandoned) as abandoned from steps s left join recent r on true group by s.step,s.position),
  day_counts as (select day,count(*) as started,count(*) filter(where status='completed') as completed,count(*) filter(where abandoned) as abandoned,count(*) filter(where status='active' and not abandoned) as active from recent group by day),
  day_steps as (select d.day,s.step,s.position,count(r.attempt_id) filter(where s.step=any(r.reached)) as reached,count(r.attempt_id) filter(where r.step=s.step and r.abandoned) as abandoned from day_counts d cross join steps s left join recent r on r.day=d.day group by d.day,s.step,s.position)
  select jsonb_build_object('version',1,'started',(select count(*) from recent),'completed',(select count(*) from recent where status='completed'),
    'abandoned',(select count(*) from recent where abandoned),'active',(select count(*) from recent where status='active' and not abandoned),
    'steps',(select jsonb_agg(jsonb_build_object('step',step,'reached',reached,'abandoned',abandoned) order by position) from counts),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d.day,'started',d.started,'completed',d.completed,'abandoned',d.abandoned,'active',d.active,
      'steps',(select jsonb_agg(jsonb_build_object('step',s.step,'reached',s.reached,'abandoned',s.abandoned) order by s.position) from day_steps s where s.day=d.day)) order by d.day) from day_counts d),'[]'::jsonb)) into result;
  return result;
end $$;
