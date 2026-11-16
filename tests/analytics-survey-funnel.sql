begin;
do $$
declare id uuid:='11111111-1111-4111-8111-111111111111'; origin text:='https://heetae1120.github.io'; e jsonb; r jsonb;
begin
  e:=jsonb_build_object('version',1,'attemptId',id,'sequence',1,'reached',jsonb_build_array('brandVision'),'step','brandVision','status','active');
  if public.kitsnode_record_survey_funnel(origin,e)->>'status'<>'ok' then raise exception 'start failed'; end if;
  e:=e||jsonb_build_object('sequence',2,'reached',jsonb_build_array('brandVision','audience'),'step','audience');
  if public.kitsnode_record_survey_funnel(origin,e)->>'status'<>'ok' then raise exception 'advance failed'; end if;
  if public.kitsnode_record_survey_funnel(origin,e||jsonb_build_object('sequence',1))->>'status'<>'duplicate' then raise exception 'old event accepted'; end if;
  e:=e||jsonb_build_object('sequence',3,'status','left');perform public.kitsnode_record_survey_funnel(origin,e);
  r:=public.kitsnode_survey_funnel_report(7);
  if (r->>'started')::int<>1 or (r->>'abandoned')::int<>1 or (r#>>'{steps,0,reached}')::int<>1 or (r#>>'{steps,1,abandoned}')::int<>1 then raise exception 'departure summary wrong: %',r; end if;
  e:=e||jsonb_build_object('sequence',4,'status','active');perform public.kitsnode_record_survey_funnel(origin,e);
  r:=public.kitsnode_survey_funnel_report(7);if (r->>'abandoned')::int<>0 or (r->>'active')::int<>1 then raise exception 'resume failed %',r; end if;
  update public.kitsnode_survey_attempts set last_activity_at=now()-interval '31 minutes' where attempt_id=id;
  r:=public.kitsnode_survey_funnel_report(7);if (r->>'abandoned')::int<>1 or (r#>>'{steps,1,abandoned}')::int<>1 then raise exception 'inactivity failed %',r; end if;
  e:=e||jsonb_build_object('sequence',5,'step','contact','reached',jsonb_build_array('brandVision','audience','contact'),'status','completed');perform public.kitsnode_record_survey_funnel(origin,e);
  r:=public.kitsnode_survey_funnel_report(7);if (r->>'completed')::int<>1 or (r->>'abandoned')::int<>0 or (r#>>'{steps,7,reached}')::int<>1 then raise exception 'completion failed %',r; end if;
  if public.kitsnode_record_survey_funnel(origin,e||jsonb_build_object('sequence',6,'status','left'))->>'status'<>'duplicate' then raise exception 'completion regressed'; end if;
  if public.kitsnode_record_survey_funnel(origin,e||jsonb_build_object('answer','private'))->>'status'<>'invalid_event' then raise exception 'extra field accepted'; end if;
  if has_table_privilege('anon','public.kitsnode_survey_attempts','select') or has_function_privilege('authenticated','public.kitsnode_survey_funnel_report(integer)','execute') then raise exception 'unexpected access'; end if;
end $$;
rollback;
