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
