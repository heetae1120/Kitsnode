-- Candidate support schema. Reviewed and applied separately from Better Auth's
-- generated schema; never applied automatically by the server.
BEGIN;
CREATE SCHEMA IF NOT EXISTS member_auth_support;
REVOKE ALL ON SCHEMA member_auth_support FROM PUBLIC;

CREATE TABLE IF NOT EXISTS member_auth_support.terms (
  version text PRIMARY KEY CHECK (length(version) BETWEEN 1 AND 128),
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS member_auth_support.consents (
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 256),
  version text NOT NULL REFERENCES member_auth_support.terms(version),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);
CREATE TABLE IF NOT EXISTS member_auth_support.oauth_state_claims (
  digest text PRIMARY KEY CHECK (digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_state_claims_expires_at_idx ON member_auth_support.oauth_state_claims (expires_at);
-- No client grants or client policies are installed. A separately provisioned
-- trusted backend owner is required; anon/authenticated access is forbidden.
ALTER TABLE member_auth_support.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_auth_support.oauth_state_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA member_auth_support FROM PUBLIC;
COMMIT;
