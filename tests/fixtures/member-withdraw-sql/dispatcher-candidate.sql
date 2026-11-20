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
