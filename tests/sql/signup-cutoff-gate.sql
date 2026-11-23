\set ON_ERROR_STOP on
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key,created_at timestamptz,raw_app_meta_data jsonb);
create schema kitsnode_member_private;
create table kitsnode_member_private.pending_email_profiles(user_id uuid primary key);
create table public.kitsnode_email_profiles(user_id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.kitsnode_my_email_profile_pending() returns boolean language sql as $$ select false $$;
create function public.kitsnode_email_profile_pending_for_service(uuid) returns boolean language sql as $$ select false $$;
revoke all on function public.kitsnode_my_email_profile_pending() from public,anon;
grant execute on function public.kitsnode_my_email_profile_pending() to authenticated;
revoke all on function public.kitsnode_email_profile_pending_for_service(uuid) from public,anon,authenticated;
grant execute on function public.kitsnode_email_profile_pending_for_service(uuid) to service_role;
\i /tmp/cutoff-gate.sql
insert into auth.users (id,created_at,raw_app_meta_data) values ('00000000-0000-4000-8000-000000000001','2026-01-01','{"provider":"email"}'),('00000000-0000-4000-8000-000000000002','2026-11-01','{"provider":"email"}'),('00000000-0000-4000-8000-000000000003','2026-11-01','{"provider":"custom:naver"}');
do $$ begin
 if public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000002') then raise exception 'disabled gate'; end if;
 if not public.kitsnode_email_profile_pending_for_service(null) then raise exception 'null user'; end if;
 if not public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000004') then raise exception 'missing user'; end if;
end $$;
update kitsnode_member_private.email_profile_gate set required_since='2026-10-01' where singleton;
do $$ begin
 if public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000001') then raise exception 'existing email user'; end if;
 if not public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000002') then raise exception 'new email user'; end if;
 if public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000003') then raise exception 'naver user'; end if;
 if has_function_privilege('anon','public.kitsnode_my_email_profile_pending()','execute') or has_function_privilege('authenticated','public.kitsnode_email_profile_pending_for_service(uuid)','execute') or has_table_privilege('authenticated','kitsnode_member_private.email_profile_gate','select') then raise exception 'unexpected privilege'; end if;
end $$;
insert into public.kitsnode_email_profiles values ('00000000-0000-4000-8000-000000000002');
do $$ begin
 if public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000002') then raise exception 'completed profile'; end if;
end $$;
insert into kitsnode_member_private.pending_email_profiles values ('00000000-0000-4000-8000-000000000001');
do $$ begin
 if not public.kitsnode_email_profile_pending_for_service('00000000-0000-4000-8000-000000000001') then raise exception 'existing marker must still be honored'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin if public.kitsnode_my_email_profile_pending() then raise exception 'authenticated completed'; end if; end $$;
reset role;
