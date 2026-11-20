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
