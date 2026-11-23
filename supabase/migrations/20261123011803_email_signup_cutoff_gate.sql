-- Prepared OFF. Activating this singleton after the updated client is live
-- avoids changing auth.users and leaves pre-existing accounts unaffected.
create table kitsnode_member_private.email_profile_gate (
 singleton boolean primary key default true check (singleton),
 required_since timestamptz
);
alter table kitsnode_member_private.email_profile_gate enable row level security;
revoke all on kitsnode_member_private.email_profile_gate from public, anon, authenticated, service_role;
insert into kitsnode_member_private.email_profile_gate(singleton,required_since) values (true,null);

create function kitsnode_member_private.email_profile_is_pending(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select case when p_user is null or not exists (select 1 from auth.users where id=p_user) then true else
   exists (select 1 from kitsnode_member_private.pending_email_profiles p where p.user_id=p_user)
   or exists (
     select 1 from auth.users u cross join kitsnode_member_private.email_profile_gate g
     where u.id=p_user and g.required_since is not null
       and u.created_at >= g.required_since
       and u.raw_app_meta_data->>'provider' = 'email'
       and not exists (select 1 from public.kitsnode_email_profiles p where p.user_id=u.id)
   ) end
$$;
revoke all on function kitsnode_member_private.email_profile_is_pending(uuid) from public,anon,authenticated,service_role;

create or replace function public.kitsnode_my_email_profile_pending()
returns boolean language sql stable security definer set search_path='' as $$
 select kitsnode_member_private.email_profile_is_pending((select auth.uid()))
$$;
create or replace function public.kitsnode_email_profile_pending_for_service(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select kitsnode_member_private.email_profile_is_pending(p_user)
$$;
