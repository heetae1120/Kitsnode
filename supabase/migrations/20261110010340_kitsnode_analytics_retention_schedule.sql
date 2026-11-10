-- Review and approve before applying to the hosted database.
-- Runs at 03:00 UTC (12:00 Korea) daily; records over 90 days old are purged.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kitsnode-analytics-retention') then
    raise exception 'analytics retention job already exists; inspect it before proceeding';
  end if;
end $$;

select cron.schedule(
  'kitsnode-analytics-retention',
  '0 3 * * *',
  'select public.kitsnode_purge_analytics()'
);
