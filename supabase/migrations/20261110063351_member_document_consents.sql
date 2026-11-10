-- Candidate only. Apply after explicit approval, backup, role and rollout review.
-- Deliberately leaves both document_current rows unconfigured. The new service
-- must remain unavailable until the reviewed real documents are activated.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE member_auth_support.document_versions (
  document_type text NOT NULL CHECK (document_type IN ('terms', 'privacy')),
  version text NOT NULL CHECK (length(version) BETWEEN 1 AND 128 AND version = btrim(version)),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_type, version)
);
CREATE TABLE member_auth_support.document_current (
  document_type text PRIMARY KEY CHECK (document_type IN ('terms', 'privacy')),
  version text NOT NULL,
  FOREIGN KEY (document_type, version) REFERENCES member_auth_support.document_versions(document_type, version)
);
CREATE TABLE member_auth_support.document_consents (
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 256 AND user_id = btrim(user_id)),
  document_type text NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_type, version),
  FOREIGN KEY (document_type, version) REFERENCES member_auth_support.document_versions(document_type, version)
);

ALTER TABLE member_auth_support.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.document_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.document_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON member_auth_support.document_versions, member_auth_support.document_current, member_auth_support.document_consents FROM PUBLIC, anon, authenticated, service_role, member_auth_runtime;
GRANT SELECT, INSERT ON member_auth_support.document_versions, member_auth_support.document_consents TO member_auth_runtime;
GRANT SELECT ON member_auth_support.document_current TO member_auth_runtime;
CREATE POLICY member_document_versions_read ON member_auth_support.document_versions FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_document_versions_insert ON member_auth_support.document_versions FOR INSERT TO member_auth_runtime WITH CHECK (true);
CREATE POLICY member_document_current_read ON member_auth_support.document_current FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_document_consents_read ON member_auth_support.document_consents FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_document_consents_insert ON member_auth_support.document_consents FOR INSERT TO member_auth_runtime WITH CHECK (true);

-- Writers of the active document pointer serialize with runtime consent
-- transactions, which acquire the shared variant before reading current rows.
-- Statement-level BEFORE covers all INSERT, UPDATE and DELETE admin paths.
CREATE FUNCTION member_auth_support.lock_document_current_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(149909178437::bigint);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION member_auth_support.lock_document_current_change() FROM PUBLIC;
CREATE TRIGGER document_current_change_lock
  BEFORE INSERT OR UPDATE OR DELETE ON member_auth_support.document_current
  FOR EACH STATEMENT EXECUTE FUNCTION member_auth_support.lock_document_current_change();

-- The old service must fail closed after this migration. Preserve existing
-- legacy records but never treat them as agreement to two separate documents.
REVOKE ALL ON member_auth_support.terms, member_auth_support.consents FROM member_auth_runtime;
COMMIT;
