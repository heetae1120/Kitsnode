-- Additional verification; preserves the existing deletion dispatcher and grants.
create function public.kitsnode_verify_member_profile_deleted(p_subject uuid,p_request uuid)
returns text language plpgsql security definer set search_path='' as $$
begin
 if p_subject is null or p_request is null then raise exception 'invalid_request'; end if;
 if not exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=p_subject and request_id=p_request) then return 'not_reserved'; end if;
 if exists(select 1 from public.kitsnode_email_profiles where user_id=p_subject)
    or exists(select 1 from kitsnode_member_private.pending_email_profiles where user_id=p_subject) then return 'data_remaining'; end if;
 return 'cleaned';
end $$;
revoke all on function public.kitsnode_verify_member_profile_deleted(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kitsnode_verify_member_profile_deleted(uuid,uuid) to service_role;
