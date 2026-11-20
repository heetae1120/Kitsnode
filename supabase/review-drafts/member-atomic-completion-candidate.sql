-- ISOLATED REVIEW ONLY. Not a migration; never apply to an operational DB.
-- Requires test-only auth/users/sessions, consent, withdrawal and profile tables.
-- The gateway must validate JWT signature, issuer, audience and expiration.
-- This candidate uses an admin-owned active document pair, separate from the
-- previously untrusted browser metadata and from temporary hard-coded notices.
create table kitsnode_member_private.member_active_documents_candidate (
 singleton boolean primary key default true check (singleton),
 terms_version text not null check (terms_version ~ '^[A-Za-z0-9._-]{1,64}$'),
 privacy_version text not null check (privacy_version ~ '^[A-Za-z0-9._-]{1,64}$'),
 terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
 privacy_sha256 text not null check (privacy_sha256 ~ '^[0-9a-f]{64}$'),
 revision bigint not null check (revision >= 1)
);
alter table kitsnode_member_private.member_active_documents_candidate enable row level security;
revoke all on kitsnode_member_private.member_active_documents_candidate from public, anon, authenticated;

-- The legacy consent PK has only version strings; immutable per-revision
-- evidence is required when the displayed content changes at the same version.
create table kitsnode_member_private.member_completion_evidence_candidate (
 user_id uuid not null references auth.users(id) on delete cascade,
 document_revision bigint not null check (document_revision>=1),
 terms_version text not null, privacy_version text not null,
 terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
 privacy_sha256 text not null check (privacy_sha256 ~ '^[0-9a-f]{64}$'),
 accepted_at timestamptz not null default clock_timestamp(),
 primary key (user_id,document_revision)
);
alter table kitsnode_member_private.member_completion_evidence_candidate enable row level security;
revoke all on kitsnode_member_private.member_completion_evidence_candidate from public, anon, authenticated;

-- A change to any active-document metadata must advance its generation.
create function kitsnode_member_private.validate_active_documents_candidate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.revision<=old.revision then raise exception 'document_revision_must_increase'; end if;
 return new;
end;
$$;
revoke all on function kitsnode_member_private.validate_active_documents_candidate() from public, anon, authenticated;
create trigger validate_active_documents_candidate before update on kitsnode_member_private.member_active_documents_candidate
for each row execute function kitsnode_member_private.validate_active_documents_candidate();

create function kitsnode_member_private.complete_email_atomic_candidate(
 p_username text, p_name text, p_phone text, p_expected_email text,
 p_terms_version text, p_privacy_version text,
 p_document_revision bigint, p_terms_sha256 text, p_privacy_sha256 text,
 p_terms_accepted boolean, p_privacy_accepted boolean, p_age_confirmed boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
 subject uuid := (select auth.uid()); claims jsonb := (select auth.jwt());
 session_text text; sid uuid; expires_text text; expires_epoch numeric;
 session_end timestamptz; current_email text; active_terms text; active_privacy text;
 active_terms_sha256 text; active_privacy_sha256 text; active_revision bigint;
 normalized text := lower(btrim(p_username)); clean_name text := btrim(p_name);
 clean_phone text := regexp_replace(btrim(p_phone), '[ -]', '', 'g');
 existing_username text; existing_name text; existing_phone text; profile_present boolean;
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
    or p_terms_accepted is distinct from true or p_privacy_accepted is distinct from true
    or p_age_confirmed is distinct from true then return 'invalid_input'; end if;

 -- Existing withdrawal ordering: subject advisory -> session -> Auth user.
 -- The active-document administrator must not acquire these locks in reverse.
 perform pg_advisory_xact_lock(hashtextextended(subject::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=subject) then return 'unavailable'; end if;
 select s.not_after into session_end from auth.sessions s where s.id=sid and s.user_id=subject for share;
 if not found or (session_end is not null and session_end<=clock_timestamp())
    or expires_epoch<=extract(epoch from clock_timestamp()) then return 'unauthenticated'; end if;
 select u.email into current_email from auth.users u where u.id=subject and u.email_confirmed_at is not null
   and u.email is not null and u.raw_app_meta_data->>'provider'='email' for share;
 if not found or p_expected_email is null or lower(current_email)<>lower(btrim(p_expected_email)) then return 'verification_required'; end if;

 -- Keep version changes behind the transaction until consent and profile commit.
 select d.terms_version,d.privacy_version,d.terms_sha256,d.privacy_sha256,d.revision
   into active_terms,active_privacy,active_terms_sha256,active_privacy_sha256,active_revision
   from kitsnode_member_private.member_active_documents_candidate d where d.singleton=true for share;
 if not found then return 'unavailable'; end if;
 if p_terms_version is distinct from active_terms or p_privacy_version is distinct from active_privacy
    or p_terms_sha256 is distinct from active_terms_sha256 or p_privacy_sha256 is distinct from active_privacy_sha256
    or p_document_revision is distinct from active_revision then return 'document_changed'; end if;
 if (session_end is not null and session_end<=clock_timestamp()) or expires_epoch<=extract(epoch from clock_timestamp()) then return 'unauthenticated'; end if;

 select p.username,p.name,p.phone into existing_username,existing_name,existing_phone
   from kitsnode_member_private.member_signup_profiles_candidate p where p.user_id=subject;
 profile_present:=found;
 if profile_present and (existing_username<>normalized or existing_name<>clean_name or existing_phone<>clean_phone) then return 'profile_exists'; end if;

 -- An exception rolls the nested block back: a contested username or expiry
 -- must never leave a newly recorded consent behind on unsuccessful completion.
 begin
   insert into public.kitsnode_member_consents(user_id,terms_version,privacy_version)
     values(subject,active_terms,active_privacy)
     on conflict (user_id,terms_version,privacy_version) do nothing;
   -- Lock the actual consent row: an existing corrupt/unconfirmed row must not
   -- count as consent, and concurrent consent withdrawal must wait for commit.
   perform 1 from public.kitsnode_member_consents c where c.user_id=subject
     and c.terms_version=active_terms and c.privacy_version=active_privacy and c.accepted_at is not null for share;
   if not found then raise exception using errcode='KX003',message='consent_unconfirmed'; end if;
   insert into kitsnode_member_private.member_completion_evidence_candidate(
     user_id,document_revision,terms_version,privacy_version,terms_sha256,privacy_sha256
   ) values(subject,active_revision,active_terms,active_privacy,active_terms_sha256,active_privacy_sha256)
     on conflict (user_id,document_revision) do nothing;
   perform 1 from kitsnode_member_private.member_completion_evidence_candidate e
     where e.user_id=subject and e.document_revision=active_revision
       and e.terms_version=active_terms and e.privacy_version=active_privacy
       and e.terms_sha256=active_terms_sha256 and e.privacy_sha256=active_privacy_sha256
       and e.accepted_at is not null for share;
   if not found then raise exception using errcode='KX003',message='consent_evidence_unconfirmed'; end if;
   if not profile_present then
     begin
       insert into kitsnode_member_private.member_signup_profiles_candidate(user_id,username,name,phone)
         values(subject,normalized,clean_name,clean_phone);
     exception when unique_violation then
       if exists(select 1 from kitsnode_member_private.member_signup_profiles_candidate p where p.username=normalized and p.user_id<>subject) then
         raise exception using errcode='KX002',message='username_conflict';
       end if;
       raise;
     end;
   end if;
   if (session_end is not null and session_end<=clock_timestamp()) or expires_epoch<=extract(epoch from clock_timestamp()) then
     raise exception using errcode='KX001',message='session_expired';
   end if;
 exception when sqlstate 'KX001' then return 'unauthenticated';
           when sqlstate 'KX002' then return 'username_taken';
           when sqlstate 'KX003' then return 'consent_unavailable';
 end;
 if profile_present then return 'already_registered'; end if;
 return 'created';
end;
$$;
revoke all on function kitsnode_member_private.complete_email_atomic_candidate(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean) from public, anon, authenticated;
grant execute on function kitsnode_member_private.complete_email_atomic_candidate(text,text,text,text,text,text,bigint,text,text,boolean,boolean,boolean) to authenticated;
