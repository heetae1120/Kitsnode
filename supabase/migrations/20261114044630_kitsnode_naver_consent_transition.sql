-- Rollout candidate: both published privacy versions accepted temporarily.
-- No Auth hooks, triggers, staff tables, or existing consent rows are changed.
BEGIN;
CREATE OR REPLACE FUNCTION kitsnode_member_private.has_confirmed_email()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND NOT coalesce(u.is_anonymous, false)
      AND (
        (u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL)
        OR EXISTS (
          SELECT 1 FROM auth.identities i
          WHERE i.user_id = u.id AND i.provider = 'custom:naver'
        )
      )
  )
$$;
ALTER POLICY kitsnode_consent_insert_own ON public.kitsnode_member_consents
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (SELECT kitsnode_member_private.has_confirmed_email())
  AND terms_version = '2026-11-14'
  AND privacy_version IN ('2026-11-14','2026-11-14-naver')
);
COMMIT;
