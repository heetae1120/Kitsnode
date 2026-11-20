-- REVIEW / ISOLATED TEST ONLY. Do not apply without ownership, permissions,
-- Storage compatibility, all member data sources and rollback review.
BEGIN;
CREATE SCHEMA IF NOT EXISTS kitsnode_member_private;
CREATE TABLE kitsnode_member_private.deletion_rate_candidate (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 window_start timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts>0)
);
REVOKE ALL ON kitsnode_member_private.deletion_rate_candidate FROM PUBLIC, anon, authenticated, service_role;
-- No persistent deletion marker. FK-free writes carrying an auth UUID must
-- validate and lock the current user in the same DB transaction. This changes
-- direct service-role calls that previously wrote unmapped UUIDs.
-- Shared by read-only precheck and the final DELETE trigger. The precheck
-- can only decline a request; a false result is not a deletion guarantee.
CREATE FUNCTION kitsnode_member_private.member_delete_blocked_candidate(p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ref record; found_ref boolean;
BEGIN
 -- Known ads tables have no user FK. They must be present and empty for the
 -- member; absent tables or a query error fail closed.
 FOR ref IN SELECT * FROM (VALUES
   ('kitsnode_ads_private','attempts','owner_id'),
   ('kitsnode_ads_private','ownership_evidence','user_id'),
   ('kitsnode_ads_private','request_limits','user_id'),
   ('kitsnode_ads_private','connections','approved_by'),
   ('kitsnode_ads_private','ownership_evidence','recorded_by'),
   ('kitsnode_ads_private','ownership_evidence','revoked_by'),
   ('kitsnode_ads_test_20261117','attempts','owner_id'),
   ('kitsnode_ads_test_20261117','ownership_evidence','user_id'),
   ('kitsnode_ads_test_20261117','request_limits','user_id'),
   ('kitsnode_ads_test_20261117','connections','approved_by'),
   ('kitsnode_ads_test_20261117','ownership_evidence','recorded_by'),
   ('kitsnode_ads_test_20261117','ownership_evidence','revoked_by')) AS required(schema_name,table_name,owner_column)
 LOOP
  IF to_regclass(format('%I.%I',ref.schema_name,ref.table_name)) IS NULL THEN RAISE EXCEPTION 'ads storage unavailable'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',ref.schema_name,ref.table_name,ref.owner_column) INTO found_ref USING p_user_id;
  IF found_ref THEN RETURN true; END IF;
 END LOOP;
 -- Storage owners are not FK-protected on the current project. Never remove
 -- objects through SQL; block deletion until their ownership is handled.
 IF to_regclass('storage.objects') IS NULL THEN RAISE EXCEPTION 'storage unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE owner=p_user_id OR
   CASE WHEN owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN owner_id::uuid=p_user_id ELSE false END) THEN RETURN true; END IF;
 FOR ref IN SELECT c.conrelid,c.conkey,c.confkey,n.nspname,t.relname
  FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
  WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND n.nspname<>'auth'
    AND NOT (n.nspname IN ('public','kitsnode_member_private') AND ((n.nspname='public' AND t.relname='kitsnode_member_consents') OR (n.nspname='kitsnode_member_private' AND t.relname='deletion_rate_candidate')) AND c.confdeltype='c'
     AND c.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=t.oid AND attname='user_id')]::smallint[]
     AND c.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='id')]::smallint[])
 LOOP
  IF array_length(ref.conkey,1)<>1 OR ref.confkey<>ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='id')]::smallint[] THEN RAISE EXCEPTION 'unsupported user reference'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',ref.nspname,ref.relname,
   (SELECT attname FROM pg_catalog.pg_attribute WHERE attrelid=ref.conrelid AND attnum=ref.conkey[1])) INTO found_ref USING p_user_id;
  IF found_ref THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.member_delete_blocked_candidate(uuid) FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.kitsnode_delete_member_precheck(p_user_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT kitsnode_member_private.member_delete_blocked_candidate(p_user_id)
$$;
REVOKE ALL ON FUNCTION public.kitsnode_delete_member_precheck(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kitsnode_delete_member_precheck(uuid) TO service_role;
CREATE FUNCTION kitsnode_member_private.guard_member_user_delete_candidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF kitsnode_member_private.member_delete_blocked_candidate(OLD.id) THEN RAISE EXCEPTION 'shared data prevents deletion' USING ERRCODE='23503'; END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.guard_member_user_delete_candidate() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kitsnode_guard_user_delete_candidate BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_member_user_delete_candidate();
-- Prevent concurrent Storage ownership inserts from slipping past the check.
-- This changes Storage writes and requires full compatibility review.
CREATE FUNCTION kitsnode_member_private.guard_storage_owner_candidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE owner_uuid uuid;
BEGIN
 -- Deterministic order when both representations differ.
 FOR owner_uuid IN SELECT DISTINCT x FROM (VALUES (NEW.owner),
  (CASE WHEN NEW.owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NEW.owner_id::uuid ELSE NULL END)) AS valueset(x) WHERE x IS NOT NULL ORDER BY x LOOP
  PERFORM 1 FROM auth.users WHERE id=owner_uuid FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'storage owner unavailable' USING ERRCODE='23503'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.guard_storage_owner_candidate() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kitsnode_guard_storage_owner_candidate BEFORE INSERT OR UPDATE OF owner,owner_id ON storage.objects FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_storage_owner_candidate();
-- FK-free writes verify/lock the referenced user in the same transaction.
-- Existing unmapped UUID writes fail; existing rows are not changed.
CREATE FUNCTION kitsnode_member_private.guard_ads_owner_candidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE value text;
BEGIN
 value:=to_jsonb(NEW)->>TG_ARGV[0];
 IF value IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM auth.users WHERE id=value::uuid FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ads owner unavailable' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.guard_ads_owner_candidate() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER kitsnode_guard_ads_attempts_candidate BEFORE INSERT OR UPDATE OF owner_id ON kitsnode_ads_private.attempts FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('owner_id');
CREATE TRIGGER kitsnode_guard_ads_evidence_candidate BEFORE INSERT OR UPDATE OF user_id ON kitsnode_ads_private.ownership_evidence FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('user_id');
CREATE TRIGGER kitsnode_guard_ads_limits_candidate BEFORE INSERT OR UPDATE OF user_id ON kitsnode_ads_private.request_limits FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('user_id');
CREATE TRIGGER kitsnode_guard_ads_approver_candidate BEFORE INSERT OR UPDATE OF approved_by ON kitsnode_ads_private.connections FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('approved_by');
CREATE TRIGGER kitsnode_guard_ads_recorder_candidate BEFORE INSERT OR UPDATE OF recorded_by ON kitsnode_ads_private.ownership_evidence FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('recorded_by');
CREATE TRIGGER kitsnode_guard_ads_revoker_candidate BEFORE INSERT OR UPDATE OF revoked_by ON kitsnode_ads_private.ownership_evidence FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('revoked_by');
CREATE TRIGGER kitsnode_guard_adstest_attempts_candidate BEFORE INSERT OR UPDATE OF owner_id ON kitsnode_ads_test_20261117.attempts FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('owner_id');
CREATE TRIGGER kitsnode_guard_adstest_evidence_candidate BEFORE INSERT OR UPDATE OF user_id ON kitsnode_ads_test_20261117.ownership_evidence FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('user_id');
CREATE TRIGGER kitsnode_guard_adstest_limits_candidate BEFORE INSERT OR UPDATE OF user_id ON kitsnode_ads_test_20261117.request_limits FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('user_id');
CREATE TRIGGER kitsnode_guard_adstest_approver_candidate BEFORE INSERT OR UPDATE OF approved_by ON kitsnode_ads_test_20261117.connections FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('approved_by');
CREATE TRIGGER kitsnode_guard_adstest_recorder_candidate BEFORE INSERT OR UPDATE OF recorded_by ON kitsnode_ads_test_20261117.ownership_evidence FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('recorded_by');
CREATE TRIGGER kitsnode_guard_adstest_revoker_candidate BEFORE INSERT OR UPDATE OF revoked_by ON kitsnode_ads_test_20261117.ownership_evidence FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.guard_ads_owner_candidate('revoked_by');
CREATE FUNCTION public.kitsnode_delete_member_limit(p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 IF p_user_id IS NULL THEN RETURN false; END IF;
 INSERT INTO kitsnode_member_private.deletion_rate_candidate(user_id,window_start,attempts) VALUES(p_user_id,clock_timestamp(),1)
 ON CONFLICT (user_id) DO UPDATE SET
  window_start=CASE WHEN kitsnode_member_private.deletion_rate_candidate.window_start<clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE kitsnode_member_private.deletion_rate_candidate.window_start END,
  attempts=CASE WHEN kitsnode_member_private.deletion_rate_candidate.window_start<clock_timestamp()-interval '1 minute' THEN 1 ELSE kitsnode_member_private.deletion_rate_candidate.attempts+1 END
 RETURNING attempts INTO n;
 RETURN n<=5;
END $$;
REVOKE ALL ON FUNCTION public.kitsnode_delete_member_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kitsnode_delete_member_limit(uuid) TO service_role;
COMMIT;
