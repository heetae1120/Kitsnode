\set ON_ERROR_STOP on
-- The stock test image has orphaned graphql watcher triggers; the actual
-- production database has no graphql event triggers. Match that local state.
do $$begin
 if exists(select 1 from pg_event_trigger where evtname='graphql_watch_drop') then alter event trigger graphql_watch_drop disable; end if;
 if exists(select 1 from pg_event_trigger where evtname='graphql_watch_ddl') then alter event trigger graphql_watch_ddl disable; end if;
end$$;
create schema kitsnode_member_private;
create table public.kitsnode_email_profiles(user_id uuid,username text);
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists email text;
create table if not exists auth.identities(user_id uuid,provider text);
\i /tmp/username-base.sql
\i /tmp/username-managed.sql
do $$
declare i integer; before_count integer;
begin
 if has_table_privilege('service_role','kitsnode_member_private.username_limit_key','select') then raise exception 'key readable by service role'; end if;
 if has_function_privilege('authenticated','public.kitsnode_consume_username_limit_auto(text,text)','execute') or has_function_privilege('anon','public.kitsnode_consume_username_limit_auto(text,text)','execute') then raise exception 'rpc publicly callable'; end if;
 if not has_function_privilege('service_role','public.kitsnode_consume_username_limit_auto(text,text)','execute') then raise exception 'service missing'; end if;
 if public.kitsnode_consume_username_limit_auto('login','bad') then raise exception 'bad name'; end if;
 for i in 1..5 loop if not public.kitsnode_consume_username_limit_auto('login','Seller_One') then raise exception 'early rejection'; end if; end loop;
 if public.kitsnode_consume_username_limit_auto('login','seller_one') then raise exception 'subject limit failed'; end if;
 if not public.kitsnode_consume_username_limit_auto('login','seller_two') then raise exception 'different user blocked'; end if;
 for i in 1..94 loop
  if not public.kitsnode_consume_username_limit_auto('login',format('user_%s',i)) then raise exception 'global rejected too early %',i; end if;
 end loop;
 select count(*) into before_count from kitsnode_member_private.username_login_limits;
 for i in 1..20 loop
  if public.kitsnode_consume_username_limit_auto('login',format('overflow_%s',i)) then raise exception 'global limit failed'; end if;
 end loop;
 if (select count(*) from kitsnode_member_private.username_login_limits)<>before_count then raise exception 'rejected subjects accumulated'; end if;
 if not public.kitsnode_consume_username_limit_auto('availability','seller_one') then raise exception 'availability bucket shared'; end if;
 update kitsnode_member_private.username_login_limits set window_start=clock_timestamp()-interval '25 hours';
 if not public.kitsnode_consume_username_limit_auto('login','new_user') then raise exception 'old window not reset'; end if;
 if exists (select 1 from kitsnode_member_private.username_login_limits where kind='login' and scope='subject' and window_start<clock_timestamp()-interval '24 hours') then raise exception 'old subjects not collected'; end if;
 if exists (select 1 from kitsnode_member_private.username_login_limits where digest='seller_one' or digest='Seller_One') then raise exception 'plaintext username stored'; end if;
 if (select count(*) from kitsnode_member_private.username_limit_key)<>1 then raise exception 'key absent'; end if;
end $$;
