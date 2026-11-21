-- Minimal email member profile. Existing Auth/Naver identities are not altered.
-- Profile creation is optional; older accounts continue to work without one.
create table public.kitsnode_email_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{3,19}$'),
 name text not null check (char_length(name) between 1 and 100 and name !~ '[[:cntrl:]]'),
 phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
 created_at timestamptz not null default now()
);
alter table public.kitsnode_email_profiles enable row level security;
revoke all on public.kitsnode_email_profiles from public,anon,authenticated;
grant select on public.kitsnode_email_profiles to authenticated;
create policy member_profile_owner_read on public.kitsnode_email_profiles for select to authenticated using ((select auth.uid())=user_id);

-- JWT verification is performed by Supabase. The database also requires an
-- active session, a confirmed email identity and the member's current consent.
create function public.kitsnode_complete_email_profile(p_username text,p_name text,p_phone text,p_age_confirmed boolean)
returns text language plpgsql security definer set search_path='' as $$
declare subject uuid:=(select auth.uid()); sid uuid; session_end timestamptz; u text:=lower(btrim(p_username)); n text:=btrim(p_name); p text:=regexp_replace(btrim(p_phone),'[ -]','','g'); existing public.kitsnode_email_profiles%rowtype;
begin
 if subject is null or coalesce((select auth.jwt())->>'session_id','') !~* '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$' then return 'verification_required'; end if;
 sid:=((select auth.jwt())->>'session_id')::uuid;
 if u is null or u !~ '^[a-z0-9][a-z0-9_-]{3,19}$' or n is null or char_length(n) not between 1 and 100 or n ~ '[[:cntrl:]]' or p_phone is null or btrim(p_phone) !~ '^[0-9 -]+$' or p !~ '^01[016789][0-9]{7,8}$' or p_age_confirmed is distinct from true then return 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(subject::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=subject) then return 'unavailable'; end if;
 select not_after into session_end from auth.sessions where id=sid and user_id=subject for share;
 if not found or (session_end is not null and session_end<=clock_timestamp()) then return 'verification_required'; end if;
 if not exists(select 1 from auth.users where id=subject and email_confirmed_at is not null) or not exists(select 1 from auth.identities where user_id=subject and provider='email') then return 'verification_required'; end if;
 perform 1 from public.kitsnode_member_consents where user_id=subject and terms_version='2026-11-14' and privacy_version='2026-11-14-naver' and accepted_at is not null for share;
 if not found then return 'consent_required'; end if;
 select * into existing from public.kitsnode_email_profiles where user_id=subject;
 if found then if existing.username=u and existing.name=n and existing.phone=p then return 'already_registered'; else return 'profile_exists'; end if; end if;
 begin
  insert into public.kitsnode_email_profiles(user_id,username,name,phone) values(subject,u,n,p);
 exception when unique_violation then return 'username_taken'; end;
 return 'created';
end $$;
revoke all on function public.kitsnode_complete_email_profile(text,text,text,boolean) from public,anon;
grant execute on function public.kitsnode_complete_email_profile(text,text,text,boolean) to authenticated;
