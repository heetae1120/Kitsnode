-- Candidate migration: do not apply until all deletion adapters and recovery paths pass integration verification.
CREATE SCHEMA IF NOT EXISTS kitsnode_member_private;

-- direct-access-candidate.sql
-- LOCAL REVIEW CANDIDATE: intentionally not an operating migration.
-- This gate covers only the enumerated authenticated RLS tables. service_role,
-- RPCs, other schemas, storage and remote workers require independent gates.
CREATE TABLE kitsnode_member_private.deletion_access_blocks (
 subject_id uuid PRIMARY KEY,
 request_id uuid UNIQUE NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE kitsnode_member_private.deletion_access_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kitsnode_member_private.deletion_access_blocks FROM PUBLIC, anon, authenticated;
CREATE FUNCTION kitsnode_member_private.deletion_access_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT (SELECT auth.uid()) IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM kitsnode_member_private.deletion_access_blocks b WHERE b.subject_id=(SELECT auth.uid())
) $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.deletion_access_allowed() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA kitsnode_member_private TO authenticated;
GRANT EXECUTE ON FUNCTION kitsnode_member_private.deletion_access_allowed() TO authenticated;
CREATE POLICY deletion_gate ON public.kitsnode_member_consents AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));
CREATE POLICY deletion_gate ON public.staff_jobs AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));
CREATE POLICY deletion_gate ON public.staff_results AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));
CREATE POLICY deletion_gate ON public.staff_memberships AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));
CREATE POLICY deletion_gate ON public.staff_store_grants AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));
CREATE POLICY deletion_gate ON public.staff_stores AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));
CREATE POLICY deletion_gate ON public.staff_companies AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT kitsnode_member_private.deletion_access_allowed())) WITH CHECK ((SELECT kitsnode_member_private.deletion_access_allowed()));


-- ads-stop-candidate.sql
-- LOCAL CANDIDATE ONLY. Requires full review, audit, runtime wiring and schema validation.
-- Call only after a durable independent deletion intent is confirmed.
CREATE FUNCTION kitsnode_member_private.protect_ad_connection() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id::text,0));
  IF EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=OLD.user_id) THEN RAISE EXCEPTION 'member_deletion_in_progress'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 IF EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=NEW.user_id)
    AND (NEW.status<>'disconnected' OR NEW.write_verified IS DISTINCT FROM false) THEN
  RAISE EXCEPTION 'member_deletion_in_progress';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.protect_ad_connection() FROM PUBLIC;
CREATE TRIGGER deletion_connection_gate BEFORE INSERT OR UPDATE OF user_id,status,write_verified ON kitsnode_ads_private.connections
FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.protect_ad_connection();
CREATE FUNCTION kitsnode_member_private.protect_ad_rule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid; old_owner uuid;
BEGIN
 IF TG_OP='UPDATE' AND OLD.connection_id IS DISTINCT FROM NEW.connection_id THEN
  SELECT user_id INTO old_owner FROM kitsnode_ads_private.connections WHERE id=OLD.connection_id;
  IF old_owner IS NULL THEN RAISE EXCEPTION 'connection_missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(old_owner::text,0));
  IF EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=old_owner) THEN RAISE EXCEPTION 'member_deletion_in_progress'; END IF;
 END IF;
 SELECT user_id INTO owner_id FROM kitsnode_ads_private.connections WHERE id=NEW.connection_id;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'connection_missing'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 IF NEW.enabled AND EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=owner_id) THEN
  RAISE EXCEPTION 'member_deletion_in_progress';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.protect_ad_rule() FROM PUBLIC;
CREATE TRIGGER deletion_rule_gate BEFORE INSERT OR UPDATE OF connection_id,enabled ON kitsnode_ads_private.rules
FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.protect_ad_rule();
CREATE FUNCTION kitsnode_member_private.stop_member_ads(p_subject uuid,p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing_request uuid;
BEGIN
 IF p_subject IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
 INSERT INTO kitsnode_member_private.deletion_access_blocks(subject_id,request_id) VALUES(p_subject,p_request)
 ON CONFLICT(subject_id) DO NOTHING;
 SELECT request_id INTO existing_request FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject;
 IF existing_request IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'request_conflict'; END IF;
 UPDATE kitsnode_ads_private.connections SET status='disconnected',write_verified=false,revision=revision+1,updated_at=now() WHERE user_id=p_subject AND (status<>'disconnected' OR write_verified IS DISTINCT FROM false);
 UPDATE kitsnode_ads_private.rules SET enabled=false,version=version+1 WHERE enabled AND connection_id IN (SELECT id FROM kitsnode_ads_private.connections WHERE user_id=p_subject);
 IF EXISTS(SELECT 1 FROM kitsnode_ads_private.attempts WHERE owner_id=p_subject AND state NOT IN ('finished','cancelled')) OR EXISTS(SELECT 1 FROM kitsnode_ads_private.shadow_schedule_claims a JOIN kitsnode_ads_private.connections c ON c.id=a.connection_id WHERE c.user_id=p_subject AND a.state IN ('claimed','uncertain')) THEN RETURN 'pending'; END IF;
 RETURN 'stopped';
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.stop_member_ads(uuid,uuid) FROM PUBLIC;

-- Local candidate; production safety depends on all writers using the same
-- admission/connection locks and actual schema ownership and retention review.
CREATE FUNCTION kitsnode_member_private.cleanup_member_ads(p_subject uuid,p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_subject IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
 IF NOT EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject AND request_id=p_request) THEN RETURN 'not_blocked'; END IF;
 PERFORM 1 FROM kitsnode_ads_private.connections WHERE user_id=p_subject FOR UPDATE;
 IF EXISTS(SELECT 1 FROM kitsnode_ads_private.connections WHERE user_id=p_subject AND (status<>'disconnected' OR write_verified IS DISTINCT FROM false)) OR EXISTS(SELECT 1 FROM kitsnode_ads_private.rules r JOIN kitsnode_ads_private.connections c ON c.id=r.connection_id WHERE c.user_id=p_subject AND r.enabled) THEN RETURN 'not_stopped'; END IF;
 IF EXISTS(SELECT 1 FROM kitsnode_ads_private.attempts WHERE owner_id=p_subject AND state<>'finished') OR EXISTS(SELECT 1 FROM kitsnode_ads_private.shadow_schedule_claims a JOIN kitsnode_ads_private.connections c ON c.id=a.connection_id WHERE c.user_id=p_subject AND a.state IN ('claimed','uncertain')) THEN RETURN 'pending'; END IF;
 IF EXISTS(SELECT 1 FROM kitsnode_ads_private.connections WHERE approved_by=p_subject AND user_id<>p_subject)
 OR EXISTS(SELECT 1 FROM kitsnode_ads_private.ownership_evidence e JOIN kitsnode_ads_private.connections c ON c.id=e.connection_id WHERE (e.recorded_by=p_subject OR e.revoked_by=p_subject OR e.user_id=p_subject) AND c.user_id<>p_subject)
 OR EXISTS(SELECT 1 FROM kitsnode_ads_private.attempts a JOIN kitsnode_ads_private.rules r ON r.id=a.rule_id JOIN kitsnode_ads_private.connections c ON c.id=r.connection_id WHERE (c.user_id=p_subject AND a.owner_id<>p_subject) OR (c.user_id<>p_subject AND a.owner_id=p_subject))
 OR EXISTS(SELECT 1 FROM kitsnode_ads_private.shadow_schedule_claims a JOIN kitsnode_ads_private.connections ac ON ac.id=a.connection_id JOIN kitsnode_ads_private.shopping_shadow_rules r ON r.id=a.rule_id JOIN kitsnode_ads_private.connections rc ON rc.id=r.connection_id WHERE ac.id<>rc.id AND (ac.user_id=p_subject OR rc.user_id=p_subject))
 OR EXISTS(SELECT 1 FROM kitsnode_ads_private.shadow_schedule_claims a JOIN kitsnode_ads_private.connections ac ON ac.id=a.connection_id JOIN kitsnode_ads_private.shopping_shadow_history h ON h.id=a.entry_id JOIN kitsnode_ads_private.shopping_shadow_rules r ON r.id=h.rule_id JOIN kitsnode_ads_private.connections rc ON rc.id=r.connection_id WHERE ac.id<>rc.id AND (ac.user_id=p_subject OR rc.user_id=p_subject)) THEN RETURN 'shared_reference'; END IF;
 DELETE FROM kitsnode_ads_private.attempt_events WHERE attempt_id IN (SELECT a.id FROM kitsnode_ads_private.attempts a JOIN kitsnode_ads_private.rules r ON r.id=a.rule_id JOIN kitsnode_ads_private.connections c ON c.id=r.connection_id WHERE c.user_id=p_subject);
 DELETE FROM kitsnode_ads_private.attempts WHERE rule_id IN (SELECT r.id FROM kitsnode_ads_private.rules r JOIN kitsnode_ads_private.connections c ON c.id=r.connection_id WHERE c.user_id=p_subject);
 DELETE FROM kitsnode_ads_private.shadow_schedule_claims WHERE connection_id IN (SELECT id FROM kitsnode_ads_private.connections WHERE user_id=p_subject);
 DELETE FROM kitsnode_ads_private.shopping_shadow_history WHERE rule_id IN (SELECT r.id FROM kitsnode_ads_private.shopping_shadow_rules r JOIN kitsnode_ads_private.connections c ON c.id=r.connection_id WHERE c.user_id=p_subject);
 DELETE FROM kitsnode_ads_private.shopping_shadow_rules WHERE connection_id IN (SELECT id FROM kitsnode_ads_private.connections WHERE user_id=p_subject);
 DELETE FROM kitsnode_ads_private.master_report_cooldowns WHERE connection_id IN (SELECT id FROM kitsnode_ads_private.connections WHERE user_id=p_subject);
 DELETE FROM kitsnode_ads_private.ownership_evidence WHERE connection_id IN (SELECT id FROM kitsnode_ads_private.connections WHERE user_id=p_subject);
 DELETE FROM kitsnode_ads_private.rules WHERE connection_id IN (SELECT id FROM kitsnode_ads_private.connections WHERE user_id=p_subject);
 DELETE FROM kitsnode_ads_private.connections WHERE user_id=p_subject;
 DELETE FROM kitsnode_ads_private.request_limits WHERE user_id=p_subject;
 RETURN 'cleaned';
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.cleanup_member_ads(uuid,uuid) FROM PUBLIC;


-- staff-attribution-candidate.sql
-- Candidate: allow deletion of a former employee's attribution without
-- deleting other employees' membership or active store permissions.
ALTER TABLE public.staff_memberships ALTER COLUMN registered_by DROP NOT NULL;
ALTER TABLE public.staff_store_grants ALTER COLUMN granted_by DROP NOT NULL;


-- staff-cleanup-candidate.sql
-- Local candidate only. This function requires a confirmed independent intent,
-- blocked access, stopped work and schema/retention verification by its caller.
CREATE FUNCTION kitsnode_member_private.cleanup_member_staff(p_subject uuid,p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_subject IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
 IF NOT EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject AND request_id=p_request) THEN RETURN 'not_blocked'; END IF;
 -- Preserve other employees' memberships and grants while removing this
 -- subject's identifying attribution. Requires the accompanying nullable columns.
 UPDATE public.staff_memberships SET registered_by=NULL WHERE registered_by=p_subject AND user_id<>p_subject;
 UPDATE public.staff_memberships SET legacy_user_id=NULL WHERE legacy_user_id=p_subject AND user_id<>p_subject;
 UPDATE public.staff_store_grants SET granted_by=NULL WHERE granted_by=p_subject AND user_id<>p_subject;
 DELETE FROM public.staff_results WHERE owner_user_id=p_subject;
 DELETE FROM public.staff_jobs WHERE owner_user_id=p_subject;
 DELETE FROM public.staff_store_grants WHERE user_id=p_subject;
 DELETE FROM public.staff_memberships WHERE user_id=p_subject;
 DELETE FROM kits_ai_private.task_events WHERE task_id IN (SELECT id FROM kits_ai_private.tasks WHERE requester_id=p_subject);
 UPDATE kits_ai_private.task_events SET actor_id=NULL WHERE actor_id=p_subject;
 DELETE FROM kits_ai_private.tasks WHERE requester_id=p_subject;
 DELETE FROM kits_ai_private.unikim_mac_transfer_grants WHERE user_id=p_subject;
 DELETE FROM kits_ai_private.staff WHERE user_id=p_subject;
 RETURN 'cleaned';
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.cleanup_member_staff(uuid,uuid) FROM PUBLIC;


-- session-cleanup-candidate.sql
-- Local candidate only. A prior permanent admission block and verified Auth
-- ban are required; deleting session rows alone does not revoke issued JWTs.
CREATE FUNCTION kitsnode_member_private.cleanup_member_sessions(p_subject uuid,p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_subject IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
 IF NOT EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject AND request_id=p_request) THEN RETURN 'not_blocked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_subject AND banned_until>now()) THEN RETURN 'not_banned'; END IF;
 DELETE FROM auth.sessions WHERE user_id=p_subject;
 IF EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=p_subject) THEN RETURN 'pending'; END IF;
 RETURN 'sessions_removed';
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.cleanup_member_sessions(uuid,uuid) FROM PUBLIC;


-- dispatcher-candidate.sql
-- Server-only RPC candidate. Apply only with all underlying gates/functions.
CREATE FUNCTION public.kits_member_deletion_step(p_step text,p_subject uuid,p_request uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r uuid;
BEGIN
 IF p_subject IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF p_step='reserve' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
  INSERT INTO kitsnode_member_private.deletion_access_blocks(subject_id,request_id) VALUES(p_subject,p_request) ON CONFLICT(subject_id) DO NOTHING;
  SELECT request_id INTO r FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject;
  IF r IS DISTINCT FROM p_request THEN RETURN 'conflict'; END IF;
  RETURN 'reserved';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject AND request_id=p_request) THEN RETURN 'not_reserved'; END IF;
 CASE p_step
  WHEN 'stop_ads' THEN RETURN kitsnode_member_private.stop_member_ads(p_subject,p_request);
  WHEN 'cleanup_ads' THEN RETURN kitsnode_member_private.cleanup_member_ads(p_subject,p_request);
  WHEN 'cleanup_staff' THEN RETURN kitsnode_member_private.cleanup_member_staff(p_subject,p_request);
  WHEN 'cleanup_sessions' THEN RETURN kitsnode_member_private.cleanup_member_sessions(p_subject,p_request);
  WHEN 'verify' THEN
   IF EXISTS(SELECT 1 FROM auth.users WHERE id=p_subject)
   OR EXISTS(SELECT 1 FROM public.kitsnode_member_consents WHERE user_id=p_subject)
   OR EXISTS(SELECT 1 FROM kitsnode_ads_private.connections WHERE user_id=p_subject OR approved_by=p_subject)
   OR EXISTS(SELECT 1 FROM kitsnode_ads_test_20261117.connections WHERE user_id=p_subject)
   OR EXISTS(SELECT 1 FROM kitsnode_ads_private.ownership_evidence WHERE user_id=p_subject OR recorded_by=p_subject OR revoked_by=p_subject)
   OR EXISTS(SELECT 1 FROM public.staff_memberships WHERE user_id=p_subject OR registered_by=p_subject OR legacy_user_id=p_subject)
   OR EXISTS(SELECT 1 FROM public.staff_store_grants WHERE user_id=p_subject OR granted_by=p_subject)
   OR EXISTS(SELECT 1 FROM public.staff_jobs WHERE owner_user_id=p_subject)
   OR EXISTS(SELECT 1 FROM public.staff_results WHERE owner_user_id=p_subject)
   OR EXISTS(SELECT 1 FROM kits_ai_private.staff WHERE user_id=p_subject)
   OR EXISTS(SELECT 1 FROM kits_ai_private.tasks WHERE requester_id=p_subject)
   OR EXISTS(SELECT 1 FROM kits_ai_private.task_events WHERE actor_id=p_subject)
   OR EXISTS(SELECT 1 FROM kits_ai_private.unikim_mac_transfer_grants WHERE user_id=p_subject)
   THEN RETURN 'data_remaining'; END IF;
   RETURN 'cleaned';
  ELSE RETURN 'invalid_step';
 END CASE;
END $$;
REVOKE ALL ON FUNCTION public.kits_member_deletion_step(text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kits_member_deletion_step(text,uuid,uuid) TO service_role;
