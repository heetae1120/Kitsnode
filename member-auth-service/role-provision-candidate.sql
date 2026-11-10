-- Review-only candidate: execute only after explicit production DB approval.
-- Prerequisites: member_auth_runtime and member_auth schemas exist; review PUBLIC grants.
-- This login has no password until a separate secure credential provisioning step.
BEGIN;
CREATE ROLE member_auth_service LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT member_auth_runtime TO member_auth_service;
ALTER ROLE member_auth_service IN DATABASE postgres SET search_path = member_auth, pg_catalog;
COMMIT;
