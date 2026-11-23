-- Customer-only withdrawal; external services are not contacted.
-- Caller and SECURITY DEFINER function owner must have the privilege required for Auth deletion.
DO $$ BEGIN
 IF NOT has_table_privilege(current_user,'auth.users','DELETE') OR NOT has_table_privilege(current_user,'auth.users','SELECT') THEN RAISE EXCEPTION 'migration_owner_missing_auth_access'; END IF;
END $$;

-- Candidate only: no wait on advertisement work; checked shared references remain protected.
CREATE OR REPLACE FUNCTION kitsnode_member_private.cleanup_customer_ads_direct(p_subject uuid,p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_subject IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
 IF NOT EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject AND request_id=p_request) THEN RETURN 'not_blocked'; END IF;
 PERFORM 1 FROM kitsnode_ads_private.connections WHERE user_id=p_subject FOR UPDATE;
 IF EXISTS(SELECT 1 FROM kitsnode_ads_private.connections WHERE approved_by=p_subject AND user_id<>p_subject)
 OR EXISTS(SELECT 1 FROM kitsnode_ads_private.ownership_evidence e JOIN kitsnode_ads_private.connections c ON c.id=e.connection_id WHERE ((e.recorded_by=p_subject OR e.revoked_by=p_subject OR e.user_id=p_subject) AND c.user_id<>p_subject) OR (c.user_id=p_subject AND e.user_id IS NOT NULL AND e.user_id<>p_subject))
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
REVOKE ALL ON FUNCTION kitsnode_member_private.cleanup_customer_ads_direct(uuid,uuid) FROM PUBLIC;


-- The operator ID list comes exclusively from server configuration.
-- Existing restrictive RLS policies use this function. Valid signed JWTs for
-- deleted identities must fail even after the temporary marker is removed.
CREATE OR REPLACE FUNCTION kitsnode_member_private.deletion_access_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL
 AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=(SELECT auth.uid()))
 AND NOT EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks b WHERE b.subject_id=(SELECT auth.uid()))
$$;
CREATE OR REPLACE FUNCTION public.kits_customer_withdraw_direct(
 p_subject uuid, p_operator_ids uuid[]
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE metadata jsonb; result text; fk record; referenced boolean;
BEGIN
 IF p_subject IS NULL OR p_operator_ids IS NULL OR cardinality(p_operator_ids)=0
    OR array_position(p_operator_ids,NULL) IS NOT NULL THEN
   RETURN 'configuration_unavailable';
 END IF;
 SELECT raw_app_meta_data INTO metadata FROM auth.users WHERE id=p_subject FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 IF p_subject=ANY(p_operator_ids) OR metadata->>'role'='admin'
    OR metadata->'admin'='true'::jsonb
    OR (jsonb_typeof(metadata->'roles')='array' AND metadata->'roles' @> '["admin"]'::jsonb)
 THEN RETURN 'admin_protected'; END IF;
 -- Preserve non-member database records regardless of their service name.
 -- The locked auth row prevents new FK references from racing this check.
 IF EXISTS(
  SELECT 1 FROM pg_catalog.pg_constraint k
  JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE k.contype='f' AND k.confrelid='auth.users'::regclass
    AND n.nspname NOT IN ('auth','kitsnode_ads_private')
    AND (array_length(k.conkey,1)<>1 OR k.confkey[1]<>(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='id'))
 ) THEN RETURN 'protected_reference'; END IF;
 FOR fk IN
  SELECT n.nspname,c.relname,a.attname
  FROM pg_catalog.pg_constraint k
  JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1]
  WHERE k.contype='f' AND k.confrelid='auth.users'::regclass
    AND array_length(k.conkey,1)=1
    AND n.nspname NOT IN ('auth','kitsnode_ads_private')
    AND NOT (n.nspname='kitsnode_member_private' AND c.relname='pending_email_profiles')
    AND NOT (n.nspname='public' AND c.relname IN ('kitsnode_email_profiles','kitsnode_member_consents'))
 LOOP
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I=$1)',fk.nspname,fk.relname,fk.attname)
   INTO referenced USING p_subject;
  IF referenced THEN RETURN 'protected_reference'; END IF;
 END LOOP;
 result:=public.kits_member_deletion_step('reserve',p_subject,p_subject);
 IF result<>'reserved' THEN RAISE EXCEPTION 'reservation_unavailable'; END IF;
 result:=kitsnode_member_private.cleanup_customer_ads_direct(p_subject,p_subject);
 IF result<>'cleaned' THEN RAISE EXCEPTION 'cleanup_unavailable'; END IF;
 DELETE FROM auth.users WHERE id=p_subject;
 IF FOUND THEN
   DELETE FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_subject AND request_id=p_subject;
   RETURN 'complete';
 END IF;
 RAISE EXCEPTION 'deletion_unavailable';
END $$;
REVOKE ALL ON FUNCTION public.kits_customer_withdraw_direct(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_customer_withdraw_direct(uuid,uuid[]) TO service_role;

DO $$ DECLARE owner_name text; BEGIN
 SELECT pg_get_userbyid(p.proowner) INTO owner_name FROM pg_proc p WHERE p.oid='public.kits_customer_withdraw_direct(uuid,uuid[])'::regprocedure;
 IF NOT has_table_privilege(owner_name,'auth.users','DELETE') OR NOT has_table_privilege(owner_name,'auth.users','SELECT') THEN RAISE EXCEPTION 'function_owner_missing_auth_access'; END IF;
 IF has_function_privilege('anon','public.kits_customer_withdraw_direct(uuid,uuid[])','EXECUTE') OR has_function_privilege('authenticated','public.kits_customer_withdraw_direct(uuid,uuid[])','EXECUTE') OR NOT has_function_privilege('service_role','public.kits_customer_withdraw_direct(uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'incorrect_function_grants'; END IF;
END $$;
