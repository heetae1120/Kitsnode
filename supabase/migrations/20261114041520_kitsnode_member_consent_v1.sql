-- Review/test candidate. This adds only keys and tables for Kitsnode; it never
-- installs hooks or triggers on shared auth.users. Not applied to production.
BEGIN;
CREATE SCHEMA kitsnode_member_private;
REVOKE ALL ON SCHEMA kitsnode_member_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA kitsnode_member_private TO authenticated;

-- An authenticated Supabase role alone can include anonymous sessions. Check
-- the actual current user row rather than trusting mutable user_metadata.
CREATE FUNCTION kitsnode_member_private.has_confirmed_email()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$ SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (SELECT auth.uid()) AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND NOT coalesce(u.is_anonymous, false)) $$;
REVOKE ALL ON FUNCTION kitsnode_member_private.has_confirmed_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION kitsnode_member_private.has_confirmed_email() TO authenticated;

CREATE TABLE public.kitsnode_member_consents (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version, privacy_version)
);
ALTER TABLE public.kitsnode_member_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kitsnode_member_consents FROM PUBLIC, anon, authenticated;
-- Prevent supplying or manipulating user_id or server timestamp via PostgREST.
GRANT SELECT (user_id, terms_version, privacy_version, accepted_at) ON public.kitsnode_member_consents TO authenticated;
GRANT INSERT (terms_version, privacy_version) ON public.kitsnode_member_consents TO authenticated;
-- Kitsnode-only withdrawal: allow deletion of one's own receipts, not Auth or
-- staff records. This is not an account deletion endpoint.
GRANT DELETE ON public.kitsnode_member_consents TO authenticated;
CREATE POLICY kitsnode_consent_select_own ON public.kitsnode_member_consents
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id AND (SELECT kitsnode_member_private.has_confirmed_email()));
CREATE POLICY kitsnode_consent_insert_own ON public.kitsnode_member_consents
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT kitsnode_member_private.has_confirmed_email()) AND terms_version = '2026-11-14' AND privacy_version = '2026-11-14');
CREATE POLICY kitsnode_consent_delete_own ON public.kitsnode_member_consents
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id AND (SELECT kitsnode_member_private.has_confirmed_email()));
COMMIT;
