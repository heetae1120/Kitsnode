-- ISOLATED REVIEW ONLY. Requires the profile review candidate and a gateway
-- that verifies JWT signatures/issuer/audience/expiry before setting claims.
-- Not a migration; do not install on a hosted project.
-- The unguarded candidate must not remain callable if testing this wrapper.
revoke execute on function kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text) from authenticated;

create function kitsnode_member_private.complete_email_profile_session_candidate(
 p_username text, p_name text, p_phone text, p_age_confirmed boolean, p_expected_email text
) returns text language plpgsql security definer set search_path = '' as $$
declare
 subject uuid := (select auth.uid()); claims jsonb := (select auth.jwt());
 session_text text; sid uuid; expires_text text; expires_epoch numeric;
 session_end timestamptz; current_email text; existing text; existing_name text; existing_phone text;
 normalized text := lower(btrim(p_username)); clean_name text := btrim(p_name);
 clean_phone text := regexp_replace(btrim(p_phone), '[ -]', '', 'g');
begin
 if subject is null or claims is null then return 'unauthenticated'; end if;
 session_text := claims->>'session_id'; expires_text := claims->>'exp';
 if session_text is null or session_text !~* '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$'
    or expires_text is null or expires_text !~ '^[0-9]{1,12}$' then return 'unauthenticated'; end if;
 sid := session_text::uuid; expires_epoch := expires_text::numeric;
 if normalized is null or normalized !~ '^[a-z0-9][a-z0-9_-]{3,19}$'
    or clean_name is null or char_length(clean_name) not between 1 and 100
    or clean_name ~ '[[:cntrl:]]' or clean_phone is null
    or btrim(p_phone) !~ '^[0-9 -]+$' or clean_phone !~ '^01[016789][0-9]{7,8}$'
    or p_age_confirmed is distinct from true then return 'invalid_input'; end if;

 -- Same subject lock/order as the withdrawal reservation before session row.
 perform pg_advisory_xact_lock(hashtextextended(subject::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=subject) then return 'unavailable'; end if;
 -- SHARE keeps a successful logout's session DELETE behind this transaction.
 select s.not_after into session_end from auth.sessions s
 where s.id=sid and s.user_id=subject for share;
 if not found or (session_end is not null and session_end<=clock_timestamp())
    or expires_epoch<=extract(epoch from clock_timestamp()) then return 'unauthenticated'; end if;
 select u.email into current_email from auth.users u where u.id=subject and u.email_confirmed_at is not null
   and u.email is not null and u.raw_app_meta_data->>'provider'='email' for share;
 if not found or p_expected_email is null or lower(current_email)<>lower(btrim(p_expected_email)) then return 'verification_required'; end if;
 perform 1 from public.kitsnode_member_consents c where c.user_id=subject
   and c.terms_version='2026-11-14' and c.privacy_version='2026-11-14-naver' and c.accepted_at is not null for share;
 if not found then return 'consent_required'; end if;
 if (session_end is not null and session_end<=clock_timestamp()) or expires_epoch<=extract(epoch from clock_timestamp()) then return 'unauthenticated'; end if;
 select username,name,phone into existing,existing_name,existing_phone from kitsnode_member_private.member_signup_profiles_candidate where user_id=subject;
 if found then
   if existing=normalized and existing_name=clean_name and existing_phone=clean_phone then return 'already_registered'; end if;
   return 'profile_exists';
 end if;
 begin
   insert into kitsnode_member_private.member_signup_profiles_candidate(user_id,username,name,phone)
   values(subject,normalized,clean_name,clean_phone);
 exception when unique_violation then return 'username_taken';
 end;
 -- Unique-index waits may have crossed expiry; roll back this insert in-place.
 if (session_end is not null and session_end<=clock_timestamp()) or expires_epoch<=extract(epoch from clock_timestamp()) then
   delete from kitsnode_member_private.member_signup_profiles_candidate where user_id=subject;
   return 'unauthenticated';
 end if;
 return 'created';
end;
$$;
revoke all on function kitsnode_member_private.complete_email_profile_session_candidate(text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function kitsnode_member_private.complete_email_profile_session_candidate(text,text,text,boolean,text) to authenticated;
