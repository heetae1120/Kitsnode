-- Keep the existing report shape and totals for the legacy owner dashboard.
-- Its strict page allowlist predates the homepage and player categories.
do $$
declare definition text; old_filter text := 'where first_seen >= now() - make_interval(days => p_days)';
begin
  definition := pg_get_functiondef('public.kitsnode_analytics_report(integer)'::regprocedure);
  if strpos(definition, 'FUNCTION public.kitsnode_analytics_report(') = 0 or strpos(definition, old_filter) = 0 then
    raise exception 'unexpected analytics report definition';
  end if;
  definition := replace(definition, 'FUNCTION public.kitsnode_analytics_report(', 'FUNCTION public.kitsnode_analytics_legacy_report(');
  definition := replace(definition, old_filter, old_filter || ' and page not in (''/'',''/tools/player/'')');
  execute definition;
end $$;
revoke all on function public.kitsnode_analytics_legacy_report(integer) from public, anon, authenticated;
grant execute on function public.kitsnode_analytics_legacy_report(integer) to service_role;

-- Only these two public, non-personal route categories are added.
alter table public.kitsnode_analytics_views drop constraint kitsnode_analytics_views_page_check;
alter table public.kitsnode_analytics_views add constraint kitsnode_analytics_views_page_check check (page in (
  '/', '/tools/player/', '/tools/', '/tools/start/', '/tools/rankings/', '/tools/seo/',
  '/tools/traffic/', '/tools/bidding/', '/tools/negative-search/', '/tools/keywords/',
  '/tools/survey/', '/tools/about/', '/tools/market/', '/tools/consultation/'
));
