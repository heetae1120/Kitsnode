-- REVIEW ONLY. Apply separately with an approved production change and rollback plan.
-- Old single-document consents are deliberately not migrated into new document consents.
BEGIN;
CREATE TABLE member_auth_support.consent_documents (
 type text NOT NULL CHECK (type IN ('terms','privacy')),
 version text NOT NULL CHECK (length(version) BETWEEN 1 AND 128),
 digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(type,version)
);
CREATE TABLE member_auth_support.member_document_acceptances (
 user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 256),
 type text NOT NULL, version text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,type,version), FOREIGN KEY(type,version) REFERENCES member_auth_support.consent_documents(type,version)
);
ALTER TABLE member_auth_support.consent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.member_document_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON member_auth_support.consent_documents,member_auth_support.member_document_acceptances FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON member_auth_support.consent_documents TO member_auth_runtime;
GRANT SELECT,INSERT ON member_auth_support.member_document_acceptances TO member_auth_runtime;
CREATE POLICY document_read ON member_auth_support.consent_documents FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY document_insert ON member_auth_support.consent_documents FOR INSERT TO member_auth_runtime WITH CHECK (true);
CREATE POLICY document_update ON member_auth_support.consent_documents FOR UPDATE TO member_auth_runtime USING (true) WITH CHECK (true);
CREATE POLICY document_consent_read ON member_auth_support.member_document_acceptances FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY document_consent_insert ON member_auth_support.member_document_acceptances FOR INSERT TO member_auth_runtime WITH CHECK (true);
COMMIT;
