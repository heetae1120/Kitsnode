begin;
do $$
declare d1 date:=(now() at time zone 'Asia/Seoul')::date-1; d2 date:=(now() at time zone 'Asia/Seoul')::date; report jsonb; yesterday jsonb; today jsonb;
begin
  insert into public.kitsnode_survey_attempts(attempt_id,origin,sequence,reached,step,status,started_at,last_activity_at) values
    ('11111111-1111-4111-8111-111111111111','https://heetae1120.github.io',1,array['brandVision','audience'],'audience','left',now()-interval '1 day',now()-interval '1 day'),
    ('22222222-2222-4222-8222-222222222222','https://heetae1120.github.io',1,array['brandVision'],'brandVision','active',now(),now());
  report:=public.kitsnode_survey_funnel_report(30);
  select x into yesterday from jsonb_array_elements(report->'daily') x where x->>'date'=d1::text;
  select x into today from jsonb_array_elements(report->'daily') x where x->>'date'=d2::text;
  if jsonb_array_length(report->'daily')<>2 or (yesterday->>'started')::int<>1 or (yesterday->>'abandoned')::int<>1 or (yesterday#>>'{steps,1,abandoned}')::int<>1 or (today->>'active')::int<>1 or (today#>>'{steps,0,reached}')::int<>1 then raise exception 'cohort mismatch %',report; end if;
  update public.kitsnode_survey_attempts set status='active',last_activity_at=now() where attempt_id='11111111-1111-4111-8111-111111111111';
  report:=public.kitsnode_survey_funnel_report(30);
  select x into yesterday from jsonb_array_elements(report->'daily') x where x->>'date'=d1::text;
  if (yesterday->>'abandoned')::int<>0 or (yesterday->>'active')::int<>1 then raise exception 'return must update original cohort %',report; end if;
end $$;
rollback;
