# Consultation storage and administrator setup

The public Pages site submits to https://kitsnode.vercel.app/api/consultations.
No application is accepted until the server has the database configuration below.

1. Create a dedicated Supabase project (Free plan if available). Enter and retain the database password yourself; never paste it in chat or source.
2. Run `keyword-api/consultations.sql` in that project's SQL editor. RLS is enabled; anon/authenticated roles have no table permissions.
3. In Supabase Auth create/invite the designated administrator email, confirm ownership, and disable new public signups. Set the Email OTP template to include `{{ .Token }}` so the admin page can accept the code. Configure production SMTP for dependable email delivery.
4. In the existing Vercel `kitsnode` project's Production environment set SUPABASE_URL, SUPABASE_ANON_KEY (public API key), SUPABASE_SERVICE_ROLE_KEY (secret, server only), CONSULTATION_ADMIN_EMAILS (comma-separated allowlist), ALLOWED_ORIGINS=https://heetae1120.github.io. Enter real secret values in Vercel, not the repo or chat. Redeploy the keyword-api project.
5. Open /Kitsnode/tools/admin/, request an email code, log in and verify the empty list. Submit a test request through the public form and verify the row appears only as the designated admin. Delete the test row through the DB after verification.

GET /api/consultations requires a valid Supabase bearer token AND a confirmed email in the server allowlist. Requests without authentication or from other users are denied before DB access. POST only accepts bounded, validated contact fields with consent. Server-side service key never reaches the browser. Rate limits are per instance; add a managed global limiter before high traffic use. The admin page keeps the token only in React memory and clears rows on logout/auth failure.

The operator must remove applicant data after the consultation purpose is fulfilled. No automatic retention job is currently configured.
