-- ISOLATED EXECUTION CONSENT CANDIDATE. Viewer ID is an untrusted browser
-- observation, never evidence of identity, ownership, or connection approval.
-- Do not use this workflow to grant account access or approve a connection.
-- The service may confirm only the exact policy text shown by this release.
-- A confirmation is scoped to an existing member session and consent record.
create table kitsnode_ads_private.invite_naver_policy_confirmation (
 consent_id uuid primary key references kitsnode_ads_private.invite_consent_candidate(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, ad_account_id text not null,
 policy_version text not null, policy_digest text not null,
 confirmed_at timestamptz not null default clock_timestamp()
);
alter table kitsnode_ads_private.invite_naver_policy_confirmation enable row level security;
revoke all on kitsnode_ads_private.invite_naver_policy_confirmation from public,anon,authenticated,service_role;
create function public.kits_invite_policy_confirm(p_consent uuid,p_user uuid,p_session uuid,p_version text,p_digest text) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare a text; sess uuid;
begin
 if p_version <> 'nav-invite-2026-11-21-v1' or p_digest <> 'c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596' then return false; end if;
 select id into sess from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()) for share;
 if sess is null then return false; end if;
 -- Acquire connection before the consent row, as the proof transitions do.
 select ad_account_id into a from kitsnode_ads_private.invite_consent_candidate where id=p_consent and user_id=p_user and session_id=p_session;
 if a is null or not kitsnode_ads_private.invite_has_active_connection(p_user,a) then return false; end if;
 perform id from kitsnode_ads_private.invite_consent_candidate where id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=a and revoked_at is null and reservation_id is null and consumed_at is null and expires_at>clock_timestamp() for update;
 if not found then return false; end if;
 insert into kitsnode_ads_private.invite_naver_policy_confirmation(consent_id,user_id,session_id,ad_account_id,policy_version,policy_digest) values(p_consent,p_user,p_session,a,p_version,p_digest) on conflict do nothing;
 if found then return true; end if;
 -- An identical retry is safe after a lost response; the consent has already
 -- been locked and checked as unexpired, unrevoked and not yet reserved.
 return exists(select 1 from kitsnode_ads_private.invite_naver_policy_confirmation where consent_id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=a and policy_version=p_version and policy_digest=p_digest);
end $$;
revoke all on function public.kits_invite_policy_confirm(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kits_invite_policy_confirm(uuid,uuid,uuid,text,text) to service_role;
create table kitsnode_ads_private.invite_proof_candidate (
 request_id uuid primary key,
 consent_id uuid not null unique references kitsnode_ads_private.invite_consent_candidate(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, ad_account_id text not null, viewer_id text not null,
 evidence_id uuid, -- always null; no viewer identity is established here
 consent_version text not null, policy_digest text not null,
 key_x text not null check(key_x ~ '^[A-Za-z0-9_-]{43}$'), key_y text not null check(key_y ~ '^[A-Za-z0-9_-]{43}$'),
 state text not null default 'approved' check(state in ('approved','reserved','begun')),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '10 minutes')
);
alter table kitsnode_ads_private.invite_proof_candidate enable row level security;
revoke all on kitsnode_ads_private.invite_proof_candidate from public,anon,authenticated,service_role;
create function public.kits_invite_consent_read_candidate(p_consent uuid,p_user uuid,p_session uuid,p_account text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r kitsnode_ads_private.invite_consent_candidate%rowtype;
begin
 if not public.kits_invite_active_session(p_user,p_session) or not kitsnode_ads_private.invite_has_active_connection(p_user,p_account) then return null; end if;
 select * into r from kitsnode_ads_private.invite_consent_candidate where id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=p_account and revoked_at is null and reservation_id is null and consumed_at is null and expires_at>clock_timestamp();
 if not found then return null; end if;
 return jsonb_build_object('consentId',r.id,'userId',r.user_id,'sessionId',r.session_id,'accountId',r.ad_account_id,'expiresAt',floor(extract(epoch from r.expires_at)*1000)::bigint,'consentVersion',r.consent_version,'consentDigest','sha256:'||r.policy_digest,'recipientId',r.recipient,'role',r.role,'autoPolicy',r.auto_policy);
end $$;
revoke all on function public.kits_invite_consent_read_candidate(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.kits_invite_consent_read_candidate(uuid,uuid,uuid,text) to service_role;
-- This verification obtains share locks. A logout, consent deletion/revocation,
-- account disconnect or evidence revocation waits for the transition to commit.
create function kitsnode_ads_private.invite_proof_binding_valid_candidate(
 p_consent uuid,p_user uuid,p_session uuid,p_account text,p_viewer text,p_evidence uuid,p_version text,p_digest text
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare sess uuid; con uuid; member uuid; policy uuid;
begin
 select id into sess from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()) for share;
 if sess is null then return false; end if;
 select user_id into member from public.kitsnode_member_consents where user_id=p_user and terms_version='2026-11-14' and privacy_version='2026-11-14-naver' for share;
 if member is null then return false; end if;
 if not kitsnode_ads_private.invite_has_active_connection(p_user,p_account) then return false; end if;
 select id into con from kitsnode_ads_private.invite_consent_candidate where id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=p_account and consent_version=p_version and policy_digest=p_digest and recipient='kitsnode' and role='OPERATIONS_VIEWER' and auto_policy and revoked_at is null and expires_at>clock_timestamp() for update;
 if con is null then return false; end if;
 select consent_id into policy from kitsnode_ads_private.invite_naver_policy_confirmation where consent_id=p_consent and user_id=p_user and session_id=p_session and ad_account_id=p_account and policy_version='nav-invite-2026-11-21-v1' and policy_digest='c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596' for share;
 if policy is null then return false; end if;
 -- Viewer is an assertion and is never evidence. This path only establishes
 -- consent to attempt an invitation, not account ownership or data access.
 return p_evidence is null;
end $$;
revoke all on function kitsnode_ads_private.invite_proof_binding_valid_candidate(uuid,uuid,uuid,text,text,uuid,text,text) from public,anon,authenticated,service_role;
create function public.kits_invite_proof_approve_candidate(
 p_request uuid,p_consent uuid,p_user uuid,p_session uuid,p_account text,p_viewer text,p_evidence uuid,p_version text,p_digest text,p_key_x text,p_key_y text,p_expiry timestamptz
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_request is null or p_expiry is null or p_expiry<=clock_timestamp() or p_expiry>clock_timestamp()+interval '10 minutes' then return false; end if;
 if not kitsnode_ads_private.invite_proof_binding_valid_candidate(p_consent,p_user,p_session,p_account,p_viewer,p_evidence,p_version,p_digest) then return false; end if;
 perform id from kitsnode_ads_private.invite_consent_candidate where id=p_consent and reservation_id is null and consumed_at is null;
 if not found then return false; end if;
 insert into kitsnode_ads_private.invite_proof_candidate(request_id,consent_id,user_id,session_id,ad_account_id,viewer_id,evidence_id,consent_version,policy_digest,key_x,key_y,expires_at)
 values(p_request,p_consent,p_user,p_session,p_account,p_viewer,p_evidence,p_version,p_digest,p_key_x,p_key_y,p_expiry)
 on conflict do nothing;
 return found;
end $$;
-- Returns only bound proof data; cryptographic verification is performed by
-- the Edge function. No caller gets access without the service-role backend.
create function public.kits_invite_proof_get_candidate(p_request uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r kitsnode_ads_private.invite_proof_candidate%rowtype;
begin
 select * into r from kitsnode_ads_private.invite_proof_candidate where request_id=p_request;
 if not found or r.expires_at<=clock_timestamp() then return null; end if;
 return jsonb_build_object('requestId',r.request_id,'consentId',r.consent_id,'userId',r.user_id,'sessionId',r.session_id,'accountId',r.ad_account_id,'viewerId',r.viewer_id,'evidenceId',r.evidence_id,'consentVersion',r.consent_version,'policyDigest',r.policy_digest,'keyX',r.key_x,'keyY',r.key_y,'state',r.state,'expiresAt',r.expires_at);
end $$;
create function public.kits_invite_proof_transition_candidate(
 p_request uuid,p_consent uuid,p_user uuid,p_session uuid,p_account text,p_viewer text,p_evidence uuid,p_version text,p_digest text,p_key_x text,p_key_y text,p_operation text
) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare expected text; next_state text; r kitsnode_ads_private.invite_proof_candidate%rowtype;
begin
 if p_operation='redeem' then expected:='approved';next_state:='reserved';
 elsif p_operation='begin_send' then expected:='reserved';next_state:='begun';
 else return false; end if;
 -- Lock binding before the request row in every transaction; key and all
 -- verified fields must still match the immutable object read for signature.
 if not kitsnode_ads_private.invite_proof_binding_valid_candidate(p_consent,p_user,p_session,p_account,p_viewer,p_evidence,p_version,p_digest) then return false; end if;
 select * into r from kitsnode_ads_private.invite_proof_candidate where request_id=p_request for update;
 if not found or r.consent_id<>p_consent or r.user_id<>p_user or r.session_id<>p_session or r.ad_account_id<>p_account or r.viewer_id<>p_viewer or r.evidence_id is distinct from p_evidence or r.consent_version<>p_version or r.policy_digest<>p_digest or r.key_x<>p_key_x or r.key_y<>p_key_y or r.state<>expected or r.expires_at<=clock_timestamp() then return false; end if;
 if p_operation='redeem' then
  if not kitsnode_ads_private.reserve_invite_consent_candidate(p_consent,p_user,p_session,p_account,p_version,p_digest,p_request) then return false; end if;
 else
  if not kitsnode_ads_private.begin_invite_send_candidate(p_consent,p_user,p_session,p_account,p_version,p_digest,p_request) then return false; end if;
 end if;
 update kitsnode_ads_private.invite_proof_candidate set state=next_state where request_id=p_request;
 return found;
end $$;
revoke all on function public.kits_invite_proof_approve_candidate(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.kits_invite_proof_get_candidate(uuid) from public,anon,authenticated;
revoke all on function public.kits_invite_proof_transition_candidate(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.kits_invite_proof_approve_candidate(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.kits_invite_proof_get_candidate(uuid) to service_role;
grant execute on function public.kits_invite_proof_transition_candidate(uuid,uuid,uuid,uuid,text,text,uuid,text,text,text,text,text) to service_role;
