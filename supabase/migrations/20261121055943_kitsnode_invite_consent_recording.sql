-- Isolated local candidate only; do not deploy without active session
-- verification, ownership, consent text, withdrawal and sender integration.
create schema if not exists kitsnode_ads_private;
revoke all on schema kitsnode_ads_private from public, anon, authenticated;
grant usage on schema kitsnode_ads_private to service_role;
create table kitsnode_ads_private.invite_consent_candidate (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null,
 ad_account_id text not null check(ad_account_id ~ '^[1-9][0-9]{0,15}$'),
 consent_version text not null check(consent_version ~ '^[A-Za-z0-9._-]{1,64}$'),
 policy_digest text not null check(policy_digest ~ '^[a-f0-9]{64}$'),
 recipient text not null check(recipient='kitsnode'), role text not null check(role='OPERATIONS_VIEWER'),
 auto_policy boolean not null check(auto_policy), created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '10 minutes'),
 reservation_id uuid, consumed_at timestamptz, revoked_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '10 minutes'),
 check(consumed_at is null or reservation_id is not null)
);
alter table kitsnode_ads_private.invite_consent_candidate enable row level security;
revoke all on kitsnode_ads_private.invite_consent_candidate from public, anon, authenticated;
-- Only the trusted backend can invoke these; it derives user AND session from
-- verified current auth. SQL functions alone do not validate current sessions.
create function kitsnode_ads_private.record_invite_consent_candidate(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into kitsnode_ads_private.invite_consent_candidate(id,user_id,session_id,ad_account_id,consent_version,policy_digest,recipient,role,auto_policy)
 values(p_id,p_user,p_session,p_account,p_version,p_digest,'kitsnode','OPERATIONS_VIEWER',true);
 return p_id;
end $$;
create function kitsnode_ads_private.reserve_invite_consent_candidate(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text,p_reservation uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_reservation is null then return false; end if;
 update kitsnode_ads_private.invite_consent_candidate set reservation_id=p_reservation
 where id=p_id and user_id=p_user and session_id=p_session and ad_account_id=p_account and consent_version=p_version and policy_digest=p_digest and reservation_id is null and consumed_at is null and revoked_at is null and expires_at>clock_timestamp();
 return found;
end $$;
create function kitsnode_ads_private.begin_invite_send_candidate(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text,p_reservation uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 update kitsnode_ads_private.invite_consent_candidate set consumed_at=clock_timestamp()
 where id=p_id and user_id=p_user and session_id=p_session and ad_account_id=p_account and consent_version=p_version and policy_digest=p_digest and reservation_id=p_reservation and consumed_at is null and revoked_at is null and expires_at>clock_timestamp();
 return found;
end $$;
create function kitsnode_ads_private.release_invite_consent_candidate(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text,p_reservation uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 update kitsnode_ads_private.invite_consent_candidate set reservation_id=null
 where id=p_id and user_id=p_user and session_id=p_session and ad_account_id=p_account and consent_version=p_version and policy_digest=p_digest and reservation_id=p_reservation and consumed_at is null and revoked_at is null;
 return found;
end $$;
revoke all on function kitsnode_ads_private.record_invite_consent_candidate(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function kitsnode_ads_private.reserve_invite_consent_candidate(uuid,uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
revoke all on function kitsnode_ads_private.begin_invite_send_candidate(uuid,uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
revoke all on function kitsnode_ads_private.release_invite_consent_candidate(uuid,uuid,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function kitsnode_ads_private.record_invite_consent_candidate(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function kitsnode_ads_private.reserve_invite_consent_candidate(uuid,uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function kitsnode_ads_private.begin_invite_send_candidate(uuid,uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function kitsnode_ads_private.release_invite_consent_candidate(uuid,uuid,uuid,text,text,text,uuid) to service_role;

-- These RPCs are server-only. The wrapper verifies the active Auth session in
-- the same database transaction as the consent mutation.
create function public.kits_invite_active_session(p_user uuid,p_session uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now()))
$$;
create function public.kits_invite_record(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text) returns uuid language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.kits_invite_active_session(p_user,p_session) then return null; end if;
 return kitsnode_ads_private.record_invite_consent_candidate(p_id,p_user,p_session,p_account,p_version,p_digest);
end $$;
create function public.kits_invite_reserve(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text,p_reservation uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.kits_invite_active_session(p_user,p_session) then return false; end if;
 return kitsnode_ads_private.reserve_invite_consent_candidate(p_id,p_user,p_session,p_account,p_version,p_digest,p_reservation);
end $$;
create function public.kits_invite_begin(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text,p_reservation uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.kits_invite_active_session(p_user,p_session) then return false; end if;
 return kitsnode_ads_private.begin_invite_send_candidate(p_id,p_user,p_session,p_account,p_version,p_digest,p_reservation);
end $$;
create function public.kits_invite_release(p_id uuid,p_user uuid,p_session uuid,p_account text,p_version text,p_digest text,p_reservation uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.kits_invite_active_session(p_user,p_session) then return false; end if;
 return kitsnode_ads_private.release_invite_consent_candidate(p_id,p_user,p_session,p_account,p_version,p_digest,p_reservation);
end $$;
revoke all on function public.kits_invite_active_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.kits_invite_record(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.kits_invite_reserve(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.kits_invite_begin(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.kits_invite_release(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.kits_invite_active_session(uuid,uuid) to service_role;
grant execute on function public.kits_invite_record(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.kits_invite_reserve(uuid,uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function public.kits_invite_begin(uuid,uuid,uuid,text,text,text,uuid) to service_role;
grant execute on function public.kits_invite_release(uuid,uuid,uuid,text,text,text,uuid) to service_role;
