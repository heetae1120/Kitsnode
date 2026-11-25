-- REVIEW ONLY. Initialize with the verified KITSNODE advertising operator IDs.
-- The registry remains unready by default; no existing user is inserted.
CREATE TABLE kitsnode_member_private.protected_admin_subjects (
 subject_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kitsnode_member_private.protected_admin_registry_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 ready boolean NOT NULL DEFAULT false,
 version bigint NOT NULL DEFAULT 0
);
INSERT INTO kitsnode_member_private.protected_admin_registry_state(singleton) VALUES(true);
ALTER TABLE kitsnode_member_private.protected_admin_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitsnode_member_private.protected_admin_registry_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kitsnode_member_private.protected_admin_subjects,kitsnode_member_private.protected_admin_registry_state FROM PUBLIC,anon,authenticated,service_role;
-- Only return whether the private registry exactly matches all configured IDs.
CREATE OR REPLACE FUNCTION public.kits_protected_admin_registry_matches(p_operator_ids uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT ready FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton),false)
 AND COALESCE(cardinality(p_operator_ids),0)>0
 AND NOT EXISTS(SELECT 1 FROM unnest(p_operator_ids) AS candidate(subject_id) WHERE candidate.subject_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=candidate.subject_id))
 AND NOT EXISTS(SELECT unnest(p_operator_ids) EXCEPT SELECT subject_id FROM kitsnode_member_private.protected_admin_subjects)
 AND NOT EXISTS(SELECT subject_id FROM kitsnode_member_private.protected_admin_subjects EXCEPT SELECT unnest(p_operator_ids))
$$;
REVOKE ALL ON FUNCTION public.kits_protected_admin_registry_matches(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_protected_admin_registry_matches(uuid[]) TO service_role;
-- Server-only monotonic preparation from the configured KITSNODE operator IDs.
-- This never turns the readiness switch on and never removes protected IDs.
CREATE OR REPLACE FUNCTION public.kits_prepare_operator_registry(p_operator_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE registry_ready boolean;
BEGIN
 IF COALESCE(cardinality(p_operator_ids),0)=0
 OR EXISTS(SELECT 1 FROM unnest(p_operator_ids) AS candidate(subject_id) WHERE candidate.subject_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=candidate.subject_id))
 OR (SELECT count(*) FROM unnest(p_operator_ids))<>(SELECT count(DISTINCT candidate.subject_id) FROM unnest(p_operator_ids) AS candidate(subject_id))
 THEN RETURN false; END IF;
 SELECT ready INTO registry_ready FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF registry_ready THEN RETURN public.kits_protected_admin_registry_matches(p_operator_ids); END IF;
 INSERT INTO kitsnode_member_private.protected_admin_subjects(subject_id)
 SELECT unnest(p_operator_ids) ON CONFLICT(subject_id) DO NOTHING;
 UPDATE kitsnode_member_private.protected_admin_registry_state SET version=version+1 WHERE singleton;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.kits_prepare_operator_registry(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_prepare_operator_registry(uuid[]) TO service_role;
-- REVIEW ONLY. Privileged maintenance functions; no public HTTP route.
-- During rotation the registry becomes unready in the same transaction that
-- changes its membership. Requests therefore fail closed until activation.
CREATE OR REPLACE FUNCTION public.kits_operator_registry_snapshot()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('ready',(SELECT ready FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton),'version',(SELECT version FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton),'ids',COALESCE((SELECT jsonb_agg(subject_id ORDER BY subject_id) FROM kitsnode_member_private.protected_admin_subjects),'[]'::jsonb))
$$;
CREATE OR REPLACE FUNCTION public.kits_operator_registry_stage(p_expected uuid[],p_desired uuid[],p_version bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_ready boolean; current_version bigint;
BEGIN
 IF p_expected IS NULL OR COALESCE(cardinality(p_desired),0)=0 OR
 EXISTS(SELECT 1 FROM unnest(p_desired) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=x)) OR
 (SELECT count(*) FROM unnest(p_desired))<>(SELECT count(DISTINCT x) FROM unnest(p_desired) x) OR
 (SELECT count(*) FROM unnest(p_expected))<>(SELECT count(DISTINCT x) FROM unnest(p_expected) x) OR
 EXISTS(SELECT 1 FROM unnest(p_expected) x WHERE x IS NULL) THEN RETURN false; END IF;
 SELECT ready,version INTO old_ready,current_version FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton FOR UPDATE;
 IF NOT FOUND OR p_version IS NULL OR current_version<>p_version THEN RETURN false; END IF;
 LOCK TABLE kitsnode_member_private.protected_admin_subjects IN EXCLUSIVE MODE;
 IF EXISTS(SELECT unnest(p_expected) EXCEPT SELECT subject_id FROM kitsnode_member_private.protected_admin_subjects)
 OR EXISTS(SELECT subject_id FROM kitsnode_member_private.protected_admin_subjects EXCEPT SELECT unnest(p_expected)) THEN RETURN false; END IF;
 UPDATE kitsnode_member_private.protected_admin_registry_state SET ready=false,version=version+1 WHERE singleton;
 DELETE FROM kitsnode_member_private.protected_admin_subjects WHERE subject_id<>ALL(p_desired);
 INSERT INTO kitsnode_member_private.protected_admin_subjects(subject_id) SELECT unnest(p_desired) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.kits_operator_registry_activate(p_desired uuid[],p_version bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_ready boolean; current_version bigint;
BEGIN
 IF COALESCE(cardinality(p_desired),0)=0 OR EXISTS(SELECT 1 FROM unnest(p_desired) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=x)) OR (SELECT count(*) FROM unnest(p_desired))<>(SELECT count(DISTINCT x) FROM unnest(p_desired) x) THEN RETURN false; END IF;
 SELECT ready,version INTO old_ready,current_version FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton FOR UPDATE;
 IF NOT FOUND OR p_version IS NULL OR current_version<>p_version THEN RETURN false; END IF;
 LOCK TABLE kitsnode_member_private.protected_admin_subjects IN EXCLUSIVE MODE;
 IF EXISTS(SELECT unnest(p_desired) EXCEPT SELECT subject_id FROM kitsnode_member_private.protected_admin_subjects) OR EXISTS(SELECT subject_id FROM kitsnode_member_private.protected_admin_subjects EXCEPT SELECT unnest(p_desired)) THEN RETURN false; END IF;
 UPDATE kitsnode_member_private.protected_admin_registry_state SET ready=true,version=version+1 WHERE singleton;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.kits_operator_registry_snapshot(),public.kits_operator_registry_stage(uuid[],uuid[],bigint),public.kits_operator_registry_activate(uuid[],bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_operator_registry_snapshot(),public.kits_operator_registry_stage(uuid[],uuid[],bigint),public.kits_operator_registry_activate(uuid[],bigint) TO service_role;
-- REVIEW ONLY. Existing RPCs and grants stay untouched. Enable only after every
-- privileged caller has been audited and moved to the guarded entry points.
CREATE OR REPLACE FUNCTION kitsnode_member_private.assert_ads_operator(p_operator_id uuid,p_operator_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE registry_ready boolean;
BEGIN
 SELECT ready INTO registry_ready FROM kitsnode_member_private.protected_admin_registry_state WHERE singleton FOR SHARE;
 IF registry_ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'operator_registry_unavailable' USING ERRCODE='42501'; END IF;
 LOCK TABLE kitsnode_member_private.protected_admin_subjects IN SHARE MODE;
 IF NOT public.kits_protected_admin_registry_matches(p_operator_ids)
 OR p_operator_id IS NULL OR NOT EXISTS(SELECT 1 FROM kitsnode_member_private.protected_admin_subjects WHERE subject_id=p_operator_id)
 THEN RAISE EXCEPTION 'operator_registry_unavailable' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.assert_ads_operator(uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.kits_ads_evidence_record_guarded(p_id uuid,p_request_id uuid,p_operator_id uuid,p_method text,p_case_ref text,p_operator_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM kitsnode_member_private.assert_ads_operator(p_operator_id,p_operator_ids); RETURN public.kits_ads_evidence_record(p_id,p_request_id,p_operator_id,p_method,p_case_ref); END $$;
CREATE OR REPLACE FUNCTION public.kits_ads_evidence_revoke_guarded(p_request_id uuid,p_evidence_id uuid,p_operator_id uuid,p_operator_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM kitsnode_member_private.assert_ads_operator(p_operator_id,p_operator_ids); RETURN public.kits_ads_evidence_revoke(p_request_id,p_evidence_id,p_operator_id); END $$;
CREATE OR REPLACE FUNCTION public.kits_ads_approve_guarded(p_request_id uuid,p_user_id uuid,p_ad_account_id text,p_revision bigint,p_customer_id text,p_naver_role text,p_operator_id uuid,p_evidence_ref text,p_operator_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM kitsnode_member_private.assert_ads_operator(p_operator_id,p_operator_ids); RETURN public.kits_ads_approve(p_request_id,p_user_id,p_ad_account_id,p_revision,p_customer_id,p_naver_role,p_operator_id,p_evidence_ref); END $$;
REVOKE ALL ON FUNCTION public.kits_ads_evidence_record_guarded(uuid,uuid,uuid,text,text,uuid[]),public.kits_ads_evidence_revoke_guarded(uuid,uuid,uuid,uuid[]),public.kits_ads_approve_guarded(uuid,uuid,text,bigint,text,text,uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_ads_evidence_record_guarded(uuid,uuid,uuid,text,text,uuid[]),public.kits_ads_evidence_revoke_guarded(uuid,uuid,uuid,uuid[]),public.kits_ads_approve_guarded(uuid,uuid,text,bigint,text,text,uuid,text,uuid[]) TO service_role;
-- Review reads are guarded by the same registry as mutations.
CREATE OR REPLACE FUNCTION public.kits_ads_review_queue_guarded(p_operator_id uuid,p_operator_ids uuid[])
RETURNS TABLE(request_id uuid,user_id uuid,ad_account_id text,status text,revision bigint,created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM kitsnode_member_private.assert_ads_operator(p_operator_id,p_operator_ids); RETURN QUERY SELECT * FROM public.kits_ads_review_queue(); END $$;
CREATE OR REPLACE FUNCTION public.kits_ads_evidence_list_guarded(p_request_id uuid,p_operator_id uuid,p_operator_ids uuid[])
RETURNS TABLE(evidence_id uuid,method text,case_ref text,recorded_by uuid,recorded_at timestamptz,expires_at timestamptz,revoked_at timestamptz,revoked_by uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM kitsnode_member_private.assert_ads_operator(p_operator_id,p_operator_ids); RETURN QUERY SELECT * FROM public.kits_ads_evidence_list(p_request_id); END $$;
CREATE OR REPLACE FUNCTION public.kits_ads_review_guarded(p_request_id uuid,p_operator_id uuid,p_operator_ids uuid[])
RETURNS TABLE(request_id uuid,user_id uuid,ad_account_id text,status text,revision bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM kitsnode_member_private.assert_ads_operator(p_operator_id,p_operator_ids); RETURN QUERY SELECT * FROM public.kits_ads_review(p_request_id); END $$;
REVOKE ALL ON FUNCTION public.kits_ads_review_queue_guarded(uuid,uuid[]),public.kits_ads_evidence_list_guarded(uuid,uuid,uuid[]),public.kits_ads_review_guarded(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_ads_review_queue_guarded(uuid,uuid[]),public.kits_ads_evidence_list_guarded(uuid,uuid,uuid[]),public.kits_ads_review_guarded(uuid,uuid,uuid[]) TO service_role;
