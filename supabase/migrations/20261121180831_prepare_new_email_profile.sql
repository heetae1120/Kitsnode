-- New email accounts created after this migration require a profile. Existing
-- Auth users and Naver signups are not backfilled or changed. This marker is
-- not consent evidence and cascades with the Auth account.
create table kitsnode_member_private.pending_email_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table kitsnode_member_private.pending_email_profiles enable row level security;
revoke all on kitsnode_member_private.pending_email_profiles from public,anon,authenticated,service_role;
create function kitsnode_member_private.mark_new_email_profile_pending()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_app_meta_data->>'provider'='email' then insert into kitsnode_member_private.pending_email_profiles(user_id) values(new.id) on conflict do nothing; end if;
 return new;
end $$;
revoke all on function kitsnode_member_private.mark_new_email_profile_pending() from public,anon,authenticated;
-- Safe preparation only: do not create an auth.users trigger here. Its owner
-- is supabase_auth_admin, so postgres cannot ALTER TABLE to disable a trigger.
-- A separately reviewed activation may create the trigger after every gate is ready.

-- Profile insertion and marker removal happen in the same transaction; any
-- failed/duplicate insert rolls back both. Only the profile RPC can insert.
create function kitsnode_member_private.clear_email_profile_pending()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from kitsnode_member_private.pending_email_profiles where user_id=new.user_id;
 return new;
end $$;
revoke all on function kitsnode_member_private.clear_email_profile_pending() from public,anon,authenticated;
create trigger kitsnode_email_profile_completed after insert on public.kitsnode_email_profiles for each row execute function kitsnode_member_private.clear_email_profile_pending();

create function public.kitsnode_my_email_profile_pending()
returns boolean language sql stable security definer set search_path='' as $$
 select case when (select auth.uid()) is null then true else exists(select 1 from kitsnode_member_private.pending_email_profiles where user_id=(select auth.uid())) end
$$;
revoke all on function public.kitsnode_my_email_profile_pending() from public,anon;
grant execute on function public.kitsnode_my_email_profile_pending() to authenticated;
create function public.kitsnode_email_profile_pending_for_service(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case when p_user is null then true else exists(select 1 from kitsnode_member_private.pending_email_profiles where user_id=p_user) end
$$;
revoke all on function public.kitsnode_email_profile_pending_for_service(uuid) from public,anon,authenticated;
grant execute on function public.kitsnode_email_profile_pending_for_service(uuid) to service_role;
