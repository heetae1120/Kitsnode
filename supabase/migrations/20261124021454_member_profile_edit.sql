-- Profile writes require an active session, current consent and an existing email profile.
create function public.kitsnode_update_member_profile(p_expected_user uuid, p_name text, p_phone text, p_company text)
returns text language plpgsql security definer set search_path='' as $$
declare subject uuid := (select auth.uid()); sid uuid; session_end timestamptz;
  n text := btrim(p_name); p text := regexp_replace(btrim(p_phone), '[ -]', '', 'g'); c text := nullif(btrim(coalesce(p_company,'')), '');
begin
 if subject is null or subject is distinct from p_expected_user or coalesce((select auth.jwt())->>'session_id','') !~* '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$' then return 'verification_required'; end if;
 if n is null or char_length(n) not between 1 and 100 or n ~ '[[:cntrl:]]' or p_phone is null or btrim(p_phone) !~ '^[0-9 -]+$' or p !~ '^01[016789][0-9]{7,8}$' or (c is not null and (char_length(c)>100 or c ~ '[[:cntrl:]]')) then return 'invalid_input'; end if;
 sid := ((select auth.jwt())->>'session_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(subject::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=subject) then return 'unavailable'; end if;
 select not_after into session_end from auth.sessions where id=sid and user_id=subject for share;
 if not found or (session_end is not null and session_end<=clock_timestamp()) then return 'verification_required'; end if;
 if not exists(select 1 from auth.users where id=subject and email_confirmed_at is not null) then return 'verification_required'; end if;
 perform 1 from public.kitsnode_member_consents where user_id=subject and terms_version='2026-11-23' and privacy_version='2026-11-23' and accepted_at is not null for share;
 if not found then return 'consent_required'; end if;
 update public.kitsnode_email_profiles set name=n, phone=p, company=c where user_id=subject;
 if not found then return 'profile_missing'; end if;
 return 'updated';
end $$;
revoke all on function public.kitsnode_update_member_profile(uuid,text,text,text) from public,anon;
grant execute on function public.kitsnode_update_member_profile(uuid,text,text,text) to authenticated;
