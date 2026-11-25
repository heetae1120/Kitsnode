-- Optional after the updated client is live and the transition is complete.
-- Existing old-version consent receipts remain readable and are not deleted.
BEGIN;
ALTER POLICY kitsnode_consent_insert_own ON public.kitsnode_member_consents
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (SELECT kitsnode_member_private.has_confirmed_email())
  AND terms_version = '2026-11-14'
  AND privacy_version = '2026-11-14-naver'
);
COMMIT;
