-- REVIEW / ISOLATED TEST ONLY. Disable deletion Edge and drain active requests
-- before running. This does not restore users or other data already deleted.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DROP TRIGGER kitsnode_guard_user_delete_candidate ON auth.users;
DROP TRIGGER kitsnode_guard_storage_owner_candidate ON storage.objects;
DROP TRIGGER kitsnode_guard_ads_attempts_candidate ON kitsnode_ads_private.attempts;
DROP TRIGGER kitsnode_guard_ads_evidence_candidate ON kitsnode_ads_private.ownership_evidence;
DROP TRIGGER kitsnode_guard_ads_limits_candidate ON kitsnode_ads_private.request_limits;
DROP TRIGGER kitsnode_guard_ads_approver_candidate ON kitsnode_ads_private.connections;
DROP TRIGGER kitsnode_guard_ads_recorder_candidate ON kitsnode_ads_private.ownership_evidence;
DROP TRIGGER kitsnode_guard_ads_revoker_candidate ON kitsnode_ads_private.ownership_evidence;
DROP TRIGGER kitsnode_guard_adstest_attempts_candidate ON kitsnode_ads_test_20261117.attempts;
DROP TRIGGER kitsnode_guard_adstest_evidence_candidate ON kitsnode_ads_test_20261117.ownership_evidence;
DROP TRIGGER kitsnode_guard_adstest_limits_candidate ON kitsnode_ads_test_20261117.request_limits;
DROP TRIGGER kitsnode_guard_adstest_approver_candidate ON kitsnode_ads_test_20261117.connections;
DROP TRIGGER kitsnode_guard_adstest_recorder_candidate ON kitsnode_ads_test_20261117.ownership_evidence;
DROP TRIGGER kitsnode_guard_adstest_revoker_candidate ON kitsnode_ads_test_20261117.ownership_evidence;
DROP FUNCTION public.kitsnode_delete_member_precheck(uuid);
DROP FUNCTION public.kitsnode_delete_member_limit(uuid);
DROP FUNCTION kitsnode_member_private.guard_member_user_delete_candidate();
DROP FUNCTION kitsnode_member_private.member_delete_blocked_candidate(uuid);
DROP FUNCTION kitsnode_member_private.guard_storage_owner_candidate();
DROP FUNCTION kitsnode_member_private.guard_ads_owner_candidate();
DROP TABLE kitsnode_member_private.deletion_rate_candidate;
-- Preserve the existing private schema and every unrelated table/function.
COMMIT;
