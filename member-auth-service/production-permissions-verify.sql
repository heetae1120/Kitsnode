-- Read-only checks to run after the reviewed migration is applied.
-- Inspect all results; empty unexpected-access queries do not replace a live
-- connection test with the separately provisioned credentials.
SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
FROM pg_roles WHERE rolname IN ('member_auth_runtime', 'member_auth_service', 'member_auth_maintenance') ORDER BY rolname;

SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('member_auth', 'member_auth_support') AND c.relkind IN ('r','p')
ORDER BY n.nspname, c.relname;

SELECT pg_has_role('member_auth_service', 'member_auth_runtime', 'USAGE') AS service_runtime,
       pg_has_role('member_auth_maintenance', 'member_auth_runtime', 'MEMBER') AS maintenance_runtime_member,
       has_table_privilege('member_auth_service', 'member_auth_support.oauth_state_claims', 'DELETE') AS service_can_delete_states,
       has_table_privilege('member_auth_maintenance', 'member_auth_support.oauth_state_claims', 'DELETE') AS maintenance_can_delete_states,
       has_column_privilege('member_auth_maintenance', 'member_auth_support.oauth_state_claims', 'expires_at', 'SELECT') AS maintenance_can_read_expiry,
       has_column_privilege('member_auth_maintenance', 'member_auth_support.oauth_state_claims', 'digest', 'SELECT') AS maintenance_can_read_digest;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('member_auth','member_auth_support')
ORDER BY schemaname, tablename, policyname;

SELECT r.rolname, n.nspname, c.relname, c.relkind
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname IN ('member_auth_service','member_auth_maintenance')
  AND n.nspname NOT IN ('member_auth','member_auth_support','information_schema')
  AND n.nspname NOT LIKE 'pg_%' AND has_schema_privilege(r.oid,n.oid,'USAGE')
  AND ((c.relkind IN ('r','p','v','m','f') AND
       (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE') OR
        has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE')))
    OR (c.relkind='S' AND has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE')))
ORDER BY 1,2,3;

SELECT r.rolname, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE r.rolname IN ('member_auth_service','member_auth_maintenance')
  AND n.nspname NOT IN ('member_auth','member_auth_support','information_schema')
  AND n.nspname NOT LIKE 'pg_%' AND has_schema_privilege(r.oid,n.oid,'USAGE')
  AND has_function_privilege(r.oid,p.oid,'EXECUTE') ORDER BY 1,2,3,4;
