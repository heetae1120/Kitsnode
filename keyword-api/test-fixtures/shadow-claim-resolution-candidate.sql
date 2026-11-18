-- LOCAL TEST CANDIDATE ONLY. Do not deploy before the independent operator
-- signature verifier and separate, least-privilege resolver role are wired.
-- This SQL does not authenticate p_operator: the only permitted caller must
-- be a separately protected resolver that verifies the operator's signature.
-- Registry provisioning and revocation require a separate administrative path.
-- The resolver cannot directly edit or insert registry rows.
create table kitsnode_ads_private.shadow_resolution_operators_candidate(operator_id uuid primary key,active boolean not null default true);
alter table kitsnode_ads_private.shadow_resolution_operators_candidate enable row level security;
revoke all on kitsnode_ads_private.shadow_resolution_operators_candidate from public,anon,authenticated,service_role,kits_claim_resolver;
-- These row locks give a serial order to auth revocation and resolution. The
-- local auth tables are fixtures; live Supabase schema/permissions must be
-- independently checked before any deployment.
create function kitsnode_ads_private.check_resolution_session_candidate(p_operator uuid,p_session uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from kitsnode_ads_private.shadow_resolution_operators_candidate where operator_id=p_operator and active for share;
 if not found then return false; end if;
 perform 1 from auth.users where id=p_operator and confirmed_at is not null and is_anonymous=false and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then return false; end if;
 perform 1 from auth.sessions where id=p_session and user_id=p_operator and (not_after is null or not_after>clock_timestamp()) for share;
 return found;
end $$;
revoke all on function kitsnode_ads_private.check_resolution_session_candidate(uuid,uuid) from public,anon,authenticated,service_role,kits_claim_resolver;
create table kitsnode_ads_private.shadow_resolution_keys_candidate (
 operator_id uuid not null, key_id text not null,
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 active boolean not null default true,
 public_key_spki text not null check(length(public_key_spki) between 40 and 128 and fingerprint=encode(sha256(decode(public_key_spki,'base64')),'hex')),
 primary key(operator_id,key_id)
);
alter table kitsnode_ads_private.shadow_resolution_keys_candidate enable row level security;
revoke all on kitsnode_ads_private.shadow_resolution_keys_candidate from public,anon,authenticated,service_role,kits_claim_resolver;

-- Append-only against app roles, not against the DB owner. Public keys are
-- non-secret; registration authenticity remains an external prerequisite.
create table kitsnode_ads_private.shadow_resolution_key_events_candidate (
 operator_id uuid not null, key_id text not null, fingerprint text not null,
 public_key_spki text not null, event text not null check(event in ('registered','revoked','reactivated')),
 event_at timestamptz not null default clock_timestamp()
);
alter table kitsnode_ads_private.shadow_resolution_key_events_candidate enable row level security;
revoke all on kitsnode_ads_private.shadow_resolution_key_events_candidate from public,anon,authenticated,service_role,kits_claim_resolver;
create function kitsnode_ads_private.record_resolution_key_event_candidate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'key_registry_delete_forbidden' using errcode='55000'; end if;
 if tg_op='UPDATE' and (new.operator_id is distinct from old.operator_id or new.key_id is distinct from old.key_id or new.fingerprint is distinct from old.fingerprint or new.public_key_spki is distinct from old.public_key_spki) then raise exception 'key_registry_identity_immutable' using errcode='55000'; end if;
 if tg_op='UPDATE' and not old.active and new.active then raise exception 'revoked_key_cannot_be_reactivated' using errcode='55000'; end if;
 if tg_op='INSERT' or new.active is distinct from old.active then
  insert into kitsnode_ads_private.shadow_resolution_key_events_candidate(operator_id,key_id,fingerprint,public_key_spki,event) values(new.operator_id,new.key_id,new.fingerprint,new.public_key_spki,case when tg_op='INSERT' then 'registered' when new.active then 'reactivated' else 'revoked' end);
 end if;
 return new;
end $$;
revoke all on function kitsnode_ads_private.record_resolution_key_event_candidate() from public,anon,authenticated,service_role,kits_claim_resolver;
create trigger shadow_resolution_key_events_candidate before insert or update or delete on kitsnode_ads_private.shadow_resolution_keys_candidate for each row execute function kitsnode_ads_private.record_resolution_key_event_candidate();

-- The verifier gets only the currently active public key. Revocation is also
-- rechecked under a row lock in the consume transaction to close races.
create function kitsnode_ads_private.get_resolution_public_key_candidate(p_operator uuid,p_key_id text) returns text
language sql stable security definer set search_path='' as $$
 select public_key_spki from kitsnode_ads_private.shadow_resolution_keys_candidate where operator_id=p_operator and key_id=p_key_id and active;
$$;
revoke all on function kitsnode_ads_private.get_resolution_public_key_candidate(uuid,text) from public,anon,authenticated,service_role,kits_claim_resolver;
grant execute on function kitsnode_ads_private.get_resolution_public_key_candidate(uuid,text) to kits_claim_resolver;

-- Local evidence bytes model only. This is not a WORM store and does not
-- establish who supplied the evidence or that it is truthful. Registrar and
-- resolver credentials are separate; neither can directly alter rows.
create table kitsnode_ads_private.shadow_resolution_evidence_candidate (
 claim_id uuid not null references kitsnode_ads_private.shadow_schedule_claims(id),
 case_ref text not null check(case_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
 content bytea not null check(octet_length(content) between 1 and 4096),
 digest text not null check(digest=encode(sha256(content),'hex')),
 active boolean not null default true, primary key(claim_id,case_ref,digest)
);
alter table kitsnode_ads_private.shadow_resolution_evidence_candidate enable row level security;
revoke all on kitsnode_ads_private.shadow_resolution_evidence_candidate from public,anon,authenticated,service_role,kits_claim_resolver,kits_evidence_registrar;
create function kitsnode_ads_private.register_resolution_evidence_candidate(p_claim uuid,p_case text,p_content bytea) returns text
language plpgsql security definer set search_path='' as $$
declare v_digest text;
begin
 if p_claim is null or p_case is null or p_case !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or p_content is null or octet_length(p_content) not between 1 and 4096 then return null; end if;
 v_digest:=encode(sha256(p_content),'hex');
 insert into kitsnode_ads_private.shadow_resolution_evidence_candidate(claim_id,case_ref,content,digest) values(p_claim,p_case,p_content,v_digest) on conflict do nothing;
 if not found then return null; end if;
 return v_digest;
end $$;
revoke all on function kitsnode_ads_private.register_resolution_evidence_candidate(uuid,text,bytea) from public,anon,authenticated,service_role,kits_claim_resolver,kits_evidence_registrar;
grant execute on function kitsnode_ads_private.register_resolution_evidence_candidate(uuid,text,bytea) to kits_evidence_registrar;
create function kitsnode_ads_private.verify_resolution_evidence_candidate(p_claim uuid,p_case text,p_digest text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from kitsnode_ads_private.shadow_resolution_evidence_candidate where claim_id=p_claim and case_ref=p_case and digest=p_digest and active and digest=encode(sha256(content),'hex'));
$$;
revoke all on function kitsnode_ads_private.verify_resolution_evidence_candidate(uuid,text,text) from public,anon,authenticated,service_role,kits_claim_resolver,kits_evidence_registrar;
grant execute on function kitsnode_ads_private.verify_resolution_evidence_candidate(uuid,text,text) to kits_claim_resolver;

create table kitsnode_ads_private.shadow_resolution_challenges_candidate (
 id uuid primary key, operator_id uuid not null, session_id uuid not null, key_id text not null, key_fingerprint text not null,
 operation text not null default 'resolve' check(operation='resolve'),
 claim_id uuid not null references kitsnode_ads_private.shadow_schedule_claims(id),
 expected_state text not null check(expected_state in ('claimed','uncertain','skipped')),
 case_ref text not null check(case_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 challenge_digest text not null check(challenge_digest ~ '^[0-9a-f]{64}$'),
 public_key_spki text not null check(length(public_key_spki) between 40 and 128 and key_fingerprint=encode(sha256(decode(public_key_spki,'base64')),'hex')),
 issued_at timestamptz not null, expires_at timestamptz not null, consumed_at timestamptz
);
alter table kitsnode_ads_private.shadow_resolution_challenges_candidate enable row level security;
revoke all on kitsnode_ads_private.shadow_resolution_challenges_candidate from public,anon,authenticated,service_role,kits_claim_resolver;

create table kitsnode_ads_private.shadow_claim_resolutions_candidate (
 claim_id uuid primary key references kitsnode_ads_private.shadow_schedule_claims(id),
 challenge_id uuid unique not null references kitsnode_ads_private.shadow_resolution_challenges_candidate(id),
 observed_state text not null check(observed_state in ('claimed','uncertain','skipped')),
 operator_id uuid not null,
 case_ref text not null check(case_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 signature_base64url text not null check(signature_base64url ~ '^[A-Za-z0-9_-]{86}$'),
 resolved_at timestamptz not null default statement_timestamp()
);
alter table kitsnode_ads_private.shadow_claim_resolutions_candidate enable row level security;
revoke all on kitsnode_ads_private.shadow_claim_resolutions_candidate from public,anon,authenticated,service_role,kits_claim_resolver;

-- A tombstone never deletes or rewrites a claim.  Every subsequent claim
-- update fails closed; the scheduled writer's history INSERT and claim UPDATE
-- share a transaction, so a late write rolls back rather than escaping fencing.
create function kitsnode_ads_private.reject_resolved_claim_update_candidate() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from kitsnode_ads_private.shadow_claim_resolutions_candidate r where r.claim_id=old.id) then
  raise exception 'resolved_claim_fenced' using errcode='55000';
 end if;
 return new;
end $$;
revoke all on function kitsnode_ads_private.reject_resolved_claim_update_candidate() from public,anon,authenticated,service_role,kits_claim_resolver;
create trigger shadow_claim_resolution_fence_candidate before update on kitsnode_ads_private.shadow_schedule_claims
for each row execute function kitsnode_ads_private.reject_resolved_claim_update_candidate();

-- Issuance and execution are called only by the independently authenticated
-- verifier service, never by the worker. The test role is a local stand-in.
create function kitsnode_ads_private.issue_resolution_challenge_candidate(p_id uuid,p_operator uuid,p_session uuid,p_key_id text,p_fingerprint text,p_claim uuid,p_expected text,p_case text,p_sha256 text,p_digest text,p_issued timestamptz,p_expires timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_public_key text;
begin
 if p_id is null or p_operator is null or p_session is null or p_key_id is null or p_key_id !~ '^[A-Za-z0-9._:-]{1,128}$' or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_claim is null or
    p_expected not in ('claimed','uncertain','skipped') or p_case is null or p_case !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
    p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' or
    p_issued is null or p_issued>statement_timestamp() or p_issued<statement_timestamp()-interval '30 seconds' or
    p_expires is null or p_expires<=statement_timestamp() or p_expires<=p_issued or p_expires>p_issued+interval '5 minutes' then return false; end if;
 if not kitsnode_ads_private.check_resolution_session_candidate(p_operator,p_session) then return false; end if;
 perform 1 from kitsnode_ads_private.shadow_resolution_evidence_candidate where claim_id=p_claim and case_ref=p_case and digest=p_sha256 and active and digest=encode(sha256(content),'hex') for share;
 if not found then return false; end if;
 select public_key_spki into v_public_key from kitsnode_ads_private.shadow_resolution_keys_candidate where operator_id=p_operator and key_id=p_key_id and fingerprint=p_fingerprint and active for share;
 if not found then return false; end if;
 insert into kitsnode_ads_private.shadow_resolution_challenges_candidate(id,operator_id,session_id,key_id,key_fingerprint,claim_id,expected_state,case_ref,evidence_sha256,challenge_digest,public_key_spki,issued_at,expires_at)
 values(p_id,p_operator,p_session,p_key_id,p_fingerprint,p_claim,p_expected,p_case,p_sha256,p_digest,v_public_key,p_issued,p_expires) on conflict do nothing;
 return found;
end $$;
revoke all on function kitsnode_ads_private.issue_resolution_challenge_candidate(uuid,uuid,uuid,text,text,uuid,text,text,text,text,timestamptz,timestamptz) from public,anon,authenticated,service_role,kits_claim_resolver;
grant execute on function kitsnode_ads_private.issue_resolution_challenge_candidate(uuid,uuid,uuid,text,text,uuid,text,text,text,text,timestamptz,timestamptz) to kits_claim_resolver;

-- Lookup returns the exact fixed v1 proof fields, never the private signing key.
create function kitsnode_ads_private.get_resolution_challenge_candidate(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'operatorId',operator_id,'sessionId',session_id,'keyId',key_id,'keyFingerprint',key_fingerprint,
   'operation',operation,'claimId',claim_id,'expectedState',expected_state,'caseRef',case_ref,'evidenceHash',evidence_sha256,
   'issuedAt',(extract(epoch from issued_at)*1000)::bigint,'expiresAt',(extract(epoch from expires_at)*1000)::bigint)
 from kitsnode_ads_private.shadow_resolution_challenges_candidate where id=p_id and consumed_at is null and expires_at>statement_timestamp();
$$;
revoke all on function kitsnode_ads_private.get_resolution_challenge_candidate(uuid) from public,anon,authenticated,service_role,kits_claim_resolver;
grant execute on function kitsnode_ads_private.get_resolution_challenge_candidate(uuid) to kits_claim_resolver;

create function kitsnode_ads_private.resolve_shadow_claim_candidate(p_challenge uuid,p_claim uuid,p_expected text,p_operator uuid,p_key_id text,p_fingerprint text,p_case text,p_sha256 text,p_digest text,p_signature text) returns boolean
language plpgsql security definer set search_path='' as $$
declare c kitsnode_ads_private.shadow_schedule_claims%rowtype; challenge kitsnode_ads_private.shadow_resolution_challenges_candidate%rowtype;
begin
 if p_challenge is null or p_claim is null or p_operator is null or p_key_id is null or p_fingerprint is null or p_expected not in ('claimed','uncertain','skipped') or
    p_case is null or p_case !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
    p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' or p_signature is null or p_signature !~ '^[A-Za-z0-9_-]{86}$' then return false; end if;
 select * into challenge from kitsnode_ads_private.shadow_resolution_challenges_candidate where id=p_challenge for update;
 if not found or challenge.consumed_at is not null or challenge.expires_at<=clock_timestamp() or
    challenge.operator_id is distinct from p_operator or challenge.key_id is distinct from p_key_id or challenge.key_fingerprint is distinct from p_fingerprint or challenge.claim_id is distinct from p_claim or
    challenge.expected_state is distinct from p_expected or challenge.case_ref is distinct from p_case or
    challenge.evidence_sha256 is distinct from p_sha256 or challenge.challenge_digest is distinct from p_digest then return false; end if;
 if not kitsnode_ads_private.check_resolution_session_candidate(p_operator,challenge.session_id) then return false; end if;
 perform 1 from kitsnode_ads_private.shadow_resolution_evidence_candidate where claim_id=p_claim and case_ref=p_case and digest=p_sha256 and active and digest=encode(sha256(content),'hex') for share;
 if not found then return false; end if;
 perform 1 from kitsnode_ads_private.shadow_resolution_keys_candidate where operator_id=p_operator and key_id=p_key_id and fingerprint=p_fingerprint and active for share;
 if not found then return false; end if;
 select * into c from kitsnode_ads_private.shadow_schedule_claims where id=p_claim for update;
 if not found or c.state is distinct from p_expected or not (
   (c.state='claimed' and c.created_at < statement_timestamp()-interval '10 minutes') or
   c.state='uncertain' or
   (c.state='skipped' and c.reason not in ('hour_expired','authorization_changed'))
 ) then return false; end if;
 -- Lock wait can cross expiry. Do not consume a challenge after it expires.
 if challenge.expires_at<=clock_timestamp() or not kitsnode_ads_private.check_resolution_session_candidate(p_operator,challenge.session_id) then return false; end if;
 insert into kitsnode_ads_private.shadow_claim_resolutions_candidate(claim_id,challenge_id,observed_state,operator_id,case_ref,evidence_sha256,signature_base64url)
 values(c.id,challenge.id,c.state,p_operator,p_case,p_sha256,p_signature) on conflict do nothing;
 if not found then return false; end if;
 update kitsnode_ads_private.shadow_resolution_challenges_candidate set consumed_at=clock_timestamp() where id=challenge.id;
 return true;
end $$;
revoke all on function kitsnode_ads_private.resolve_shadow_claim_candidate(uuid,uuid,text,uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role,kits_claim_resolver;
grant execute on function kitsnode_ads_private.resolve_shadow_claim_candidate(uuid,uuid,text,uuid,text,text,text,text,text,text) to kits_claim_resolver;

-- Used only for retry-free duplicate classification of this exact claim. This
-- exposes no operator, reason or evidence to the worker's service role.
create function kitsnode_ads_private.shadow_claim_is_resolved_candidate(p_claim uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from kitsnode_ads_private.shadow_claim_resolutions_candidate r where r.claim_id=p_claim);
$$;
revoke all on function kitsnode_ads_private.shadow_claim_is_resolved_candidate(uuid) from public,anon,authenticated,service_role,kits_claim_resolver;
grant execute on function kitsnode_ads_private.shadow_claim_is_resolved_candidate(uuid) to service_role;

-- Composition candidate for the v2 claim RPC. Run after the base claim and v2
-- migration. Closure is checked before classifying unchanged ledger state;
-- it never reopens a slot or returns another claim to the worker.
create or replace function public.kits_shadow_schedule_claim_v2(p_rule_id uuid,p_rule_version bigint,p_connection_id uuid,p_slot_start_ms bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_claim jsonb; v_id uuid; v_state text; v_reason text; v_connection uuid; v_created_at timestamptz;
begin
 v_claim:=public.kits_shadow_schedule_claim(p_rule_id,p_rule_version,p_connection_id,p_slot_start_ms);
 if v_claim is not null then return jsonb_build_object('status','claimed','claim',v_claim); end if;
 select a.id,a.state,a.reason,a.connection_id,a.created_at into v_id,v_state,v_reason,v_connection,v_created_at from kitsnode_ads_private.shadow_schedule_claims a
 where a.rule_id=p_rule_id and a.slot_start=to_timestamp(p_slot_start_ms/1000.0);
 if v_connection is distinct from p_connection_id then return jsonb_build_object('status','rejected'); end if;
 if kitsnode_ads_private.shadow_claim_is_resolved_candidate(v_id) then return jsonb_build_object('status','already_resolved'); end if;
 if v_state='recorded' then return jsonb_build_object('status','already_recorded'); end if;
 if v_state='skipped' and v_reason in ('hour_expired','authorization_changed') then return jsonb_build_object('status','already_skipped'); end if;
 if v_state='claimed' and v_created_at>=statement_timestamp()-interval '10 minutes' then return jsonb_build_object('status','in_progress'); end if;
 if v_state in ('claimed','uncertain','skipped') then return jsonb_build_object('status','unresolved'); end if;
 return jsonb_build_object('status','rejected');
end $$;
revoke all on function public.kits_shadow_schedule_claim_v2(uuid,bigint,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.kits_shadow_schedule_claim_v2(uuid,bigint,uuid,bigint) to service_role;

-- The monitoring reader uses only this aggregate; separate plugin/proc alerts
-- remain necessary. Resolution acknowledges the simulation record, not that
-- the provider did or did not serve an ad; it does not release the unique slot.
create function kitsnode_ads_private.unresolved_shadow_claims_candidate() returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from kitsnode_ads_private.shadow_schedule_claims c
 where ((c.state='claimed' and c.created_at < statement_timestamp()-interval '10 minutes') or
        c.state='uncertain' or (c.state='skipped' and c.reason not in ('hour_expired','authorization_changed')))
   and not exists(select 1 from kitsnode_ads_private.shadow_claim_resolutions_candidate r where r.claim_id=c.id);
$$;
revoke all on function kitsnode_ads_private.unresolved_shadow_claims_candidate() from public,anon,authenticated,service_role,kits_claim_resolver;
grant execute on function kitsnode_ads_private.unresolved_shadow_claims_candidate() to service_role;

create or replace function public.kits_shadow_schedule_unresolved() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('staleClaimed',(select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='claimed' and a.created_at < statement_timestamp()-interval '10 minutes' and not kitsnode_ads_private.shadow_claim_is_resolved_candidate(a.id)),
  'uncertain',(select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='uncertain' and not kitsnode_ads_private.shadow_claim_is_resolved_candidate(a.id))+
  (select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='skipped' and a.reason not in ('hour_expired','authorization_changed') and not kitsnode_ads_private.shadow_claim_is_resolved_candidate(a.id)));
$$;
revoke all on function public.kits_shadow_schedule_unresolved() from public,anon,authenticated,service_role;
grant execute on function public.kits_shadow_schedule_unresolved() to service_role;
