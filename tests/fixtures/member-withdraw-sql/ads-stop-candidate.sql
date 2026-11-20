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
