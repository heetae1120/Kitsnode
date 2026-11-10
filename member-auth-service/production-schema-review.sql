-- REVIEW CANDIDATE ONLY: do not apply until explicitly approved and blockers resolved.
-- No password, terms, users, or application deployment are included.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA member_auth_support;
REVOKE ALL ON SCHEMA member_auth_support FROM PUBLIC;

CREATE TABLE member_auth_support.terms (
  version text PRIMARY KEY CHECK (length(version) BETWEEN 1 AND 128),
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE member_auth_support.consents (
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 256),
  version text NOT NULL REFERENCES member_auth_support.terms(version),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);
CREATE TABLE member_auth_support.oauth_state_claims (
  digest text PRIMARY KEY CHECK (digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL
);
CREATE INDEX oauth_state_claims_expires_at_idx ON member_auth_support.oauth_state_claims (expires_at);
ALTER TABLE member_auth_support.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.oauth_state_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA member_auth_support FROM PUBLIC;

CREATE TABLE member_auth_support.request_limits (
  bucket text PRIMARY KEY CHECK (bucket = 'auth-global'),
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0)
);
ALTER TABLE member_auth_support.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON member_auth_support.request_limits FROM PUBLIC;

CREATE ROLE member_auth_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA member_auth_support TO member_auth_runtime;
GRANT SELECT, INSERT, UPDATE ON member_auth_support.terms TO member_auth_runtime;
GRANT SELECT, INSERT ON member_auth_support.consents TO member_auth_runtime;
GRANT SELECT, INSERT ON member_auth_support.oauth_state_claims TO member_auth_runtime;
GRANT SELECT, INSERT, UPDATE ON member_auth_support.request_limits TO member_auth_runtime;
CREATE POLICY member_auth_terms_read ON member_auth_support.terms FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_auth_terms_insert ON member_auth_support.terms FOR INSERT TO member_auth_runtime WITH CHECK (true);
CREATE POLICY member_auth_terms_update ON member_auth_support.terms FOR UPDATE TO member_auth_runtime USING (true) WITH CHECK (true);
CREATE POLICY member_auth_consents_read ON member_auth_support.consents FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_auth_consents_insert ON member_auth_support.consents FOR INSERT TO member_auth_runtime WITH CHECK (true);
CREATE POLICY member_auth_state_read ON member_auth_support.oauth_state_claims FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_auth_state_insert ON member_auth_support.oauth_state_claims FOR INSERT TO member_auth_runtime WITH CHECK (true);

-- Separate credential for scheduled cleanup; no membership in the runtime role.
CREATE ROLE member_auth_maintenance LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA member_auth_support TO member_auth_maintenance;
GRANT SELECT (expires_at), DELETE ON member_auth_support.oauth_state_claims TO member_auth_maintenance;
CREATE POLICY member_auth_state_maintenance_read ON member_auth_support.oauth_state_claims FOR SELECT TO member_auth_maintenance USING (expires_at < now());
CREATE POLICY member_auth_state_maintenance_delete ON member_auth_support.oauth_state_claims FOR DELETE TO member_auth_maintenance USING (expires_at < now());
CREATE POLICY member_auth_limits_read ON member_auth_support.request_limits FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_auth_limits_insert ON member_auth_support.request_limits FOR INSERT TO member_auth_runtime WITH CHECK (true);
CREATE POLICY member_auth_limits_update ON member_auth_support.request_limits FOR UPDATE TO member_auth_runtime USING (true) WITH CHECK (true);

CREATE SCHEMA member_auth;
REVOKE ALL ON SCHEMA member_auth FROM PUBLIC;
CREATE TABLE member_auth."user" (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 "emailVerified" boolean NOT NULL DEFAULT false, image text,
 "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE TABLE member_auth.session (
 id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE,
 "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL,
 "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES member_auth."user"(id) ON DELETE CASCADE
);
CREATE INDEX member_auth_session_user_id_idx ON member_auth.session ("userId");
CREATE TABLE member_auth.account (
 id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL,
 "userId" text NOT NULL REFERENCES member_auth."user"(id) ON DELETE CASCADE,
 "accessToken" text, "refreshToken" text, "idToken" text,
 "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz,
 scope text, password text, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE INDEX member_auth_account_user_id_idx ON member_auth.account ("userId");
CREATE UNIQUE INDEX member_auth_provider_account_unique_idx ON member_auth.account ("providerId", "accountId");
CREATE TABLE member_auth.verification (
 id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
 "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL
);
CREATE INDEX member_auth_verification_identifier_idx ON member_auth.verification (identifier);
ALTER TABLE member_auth."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth.verification ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA member_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA member_auth TO member_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA member_auth TO member_auth_runtime;
CREATE POLICY auth_user_backend ON member_auth."user" TO member_auth_runtime USING (true) WITH CHECK (true);
CREATE POLICY auth_session_backend ON member_auth.session TO member_auth_runtime USING (true) WITH CHECK (true);
CREATE POLICY auth_account_backend ON member_auth.account TO member_auth_runtime USING (true) WITH CHECK (true);
CREATE POLICY auth_verification_backend ON member_auth.verification TO member_auth_runtime USING (true) WITH CHECK (true);

CREATE ROLE member_auth_service LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT member_auth_runtime TO member_auth_service;
ALTER ROLE member_auth_service IN DATABASE postgres SET search_path = member_auth, pg_catalog;

COMMIT;
