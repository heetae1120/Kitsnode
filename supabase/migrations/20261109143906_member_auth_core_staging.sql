-- Staging-only candidate based on installed better-auth 1.7.18 core fields.
-- Never apply automatically; test role and actual adapter with an isolated DB.
BEGIN;
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
COMMIT;
