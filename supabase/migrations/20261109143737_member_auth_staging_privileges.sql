-- Staging candidate only: role is NOLOGIN and no passwords or memberships are created.
-- Apply only in an isolated project after verifying role administration privileges.
BEGIN;
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
CREATE POLICY member_auth_limits_read ON member_auth_support.request_limits FOR SELECT TO member_auth_runtime USING (true);
CREATE POLICY member_auth_limits_insert ON member_auth_support.request_limits FOR INSERT TO member_auth_runtime WITH CHECK (true);
CREATE POLICY member_auth_limits_update ON member_auth_support.request_limits FOR UPDATE TO member_auth_runtime USING (true) WITH CHECK (true);
COMMIT;
