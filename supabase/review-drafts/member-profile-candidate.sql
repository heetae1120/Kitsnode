-- ISOLATED REVIEW CANDIDATE. Not a migration; do not apply to an operational DB.
-- Prerequisites: Supabase auth.uid(), auth.users, existing member consent and
-- withdrawal-block tables. Public Auth signup remains independently reachable;
-- this function alone does not gate membership or guarantee signup completion.
create table kitsnode_member_private.member_signup_profiles_candidate (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{3,19}$'),
 name text not null check (char_length(name) between 1 and 100),
 phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
 age_confirmed_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table kitsnode_member_private.member_signup_profiles_candidate enable row level security;
revoke all on kitsnode_member_private.member_signup_profiles_candidate from public, anon, authenticated;

-- The subject comes solely from the Auth session; no caller-supplied user ID.
-- Only a confirmed email user with current recorded consent can claim. Existing
-- verified email members can claim without altering their authentication.
create function kitsnode_member_private.complete_email_profile_candidate(
 p_username text, p_name text, p_phone text, p_age_confirmed boolean, p_expected_email text
) returns text language plpgsql security definer set search_path = '' as $$
declare
 subject uuid := (select auth.uid());
 normalized text := lower(btrim(p_username));
 clean_name text := btrim(p_name);
 clean_phone text := regexp_replace(btrim(p_phone), '[ -]', '', 'g');
 existing text;
 existing_name text;
 existing_phone text;
 current_email text;
begin
 if subject is null then return 'unauthenticated'; end if;
 if normalized is null or normalized !~ '^[a-z0-9][a-z0-9_-]{3,19}$'
    or clean_name is null or char_length(clean_name) not between 1 and 100
    or clean_name ~ '[[:cntrl:]]' or clean_phone is null
    or btrim(p_phone) !~ '^[0-9 -]+$' or clean_phone !~ '^01[016789][0-9]{7,8}$'
    or p_age_confirmed is distinct from true then return 'invalid_input'; end if;
 -- Same per-member lock as withdrawal reservation; both paths must use it.
 perform pg_advisory_xact_lock(hashtextextended(subject::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=subject) then return 'unavailable'; end if;
 select u.email into current_email from auth.users u where u.id=subject and u.email_confirmed_at is not null
   and u.email is not null and u.raw_app_meta_data->>'provider'='email' for share;
 if not found or p_expected_email is null or lower(current_email) <> lower(btrim(p_expected_email)) then return 'verification_required'; end if;
 if not exists(select 1 from public.kitsnode_member_consents c where c.user_id=subject
     and c.terms_version='2026-11-14' and c.privacy_version='2026-11-14-naver' and c.accepted_at is not null) then return 'consent_required'; end if;
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
 return 'created';
end;
$$;
revoke all on function kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text) from public, anon, authenticated;
grant usage on schema kitsnode_member_private to authenticated;
grant execute on function kitsnode_member_private.complete_email_profile_candidate(text,text,text,boolean,text) to authenticated;
