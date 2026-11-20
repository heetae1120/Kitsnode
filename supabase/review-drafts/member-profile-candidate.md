# Email member profile candidate (local review only)

`member-profile-candidate.sql` is deliberately outside migrations and is not wired to the website or PostgREST. It models one part of signup, not an operational signup API.

## Contract

After a server-validated Supabase email session is confirmed, `complete_email_profile_candidate(username,name,phone,age_confirmed,expected_email)` derives the subject from `auth.uid()` (never a caller user ID). It requires a confirmed email identity, current existing consent, affirmative age confirmation and no member withdrawal block. It normalizes the username, validates fields and inserts a profile protected by a database unique constraint. The existing consent insert trigger remains unchanged. An identical completed username retry returns `already_registered`; another username for the same member returns `profile_exists`; a conflicting username returns `username_taken`. The SQL advisory lock matches the lock used by member withdrawal; a profile is cascade-deleted when its auth user is deleted.

An idempotent retry returns `already_registered` only if the normalized username, name and phone all match the saved profile. Any mismatch returns `profile_exists` and does not change the saved fields.

This is a **post-verification** completion step; it does not implement the one-shot pre-verification form's `register(...)` or `checkUsername(...)` contract. An availability check can be stale and must never be treated as a reservation. Users may need to choose another ID at completion if another user claimed it first. Existing email users can claim a username after signing in and meeting the same requirements; a dedicated transition policy and tested provider-link handling remain necessary. Do not infer account existence from errors other than an explicitly designed ID-availability response.

## Release blockers

- The public Supabase Auth signup can bypass a client signup flag and create an account without this profile or age confirmation. Existing consent metadata trigger does not enforce these fields. Every member-facing server endpoint, RLS policy, and external function must use an authoritative onboarding-completion gate, including the Naver path, before this design could be published. The user's requirement for entering all fields before email verification needs a secure temporary registration flow or explicit UX acceptance; this candidate doesn't solve that requirement.
- A dedicated server-only username-to-auth-subject/email lookup and password authentication adapter are not implemented. The lookup must never disclose email to a caller; all unknown ID, incorrect password, unverified account and denied account responses should be indistinguishable, with distributed account and network rate limits and an independent denial-of-service assessment. Public ID availability likewise needs an explicit privacy, throttling and abuse policy.
- No API route, remote migration, grants to production roles or configuration changes are supplied. A private-schema function is not automatically reachable through PostgREST; service/RPC architecture needs to be decided and authorization audited. Current version strings match the existing *temporary* consent documents and must be replaced by the final centrally managed policy rather than hard-coded for production.
- Validate provider linkage and user enumeration behavior of the actual Supabase Auth instance; profile completion and consent must be rechecked on the same durable account identity. Validate distributed rate limits, rejected/unconfirmed signup cleanup, account recovery, email edits, session revocation, withdrawal/re-registration and same-user races against real Supabase locally before deployment.
- Withdrawal currently uses the same advisory lock for reservation; integration must also confirm all real deletion paths acquire this lock and that table cleanup, identity revocation and sensitive API checks remain correct. FK cascade by itself does not invalidate a previously issued JWT.

## Verification

Run `./tests/sql/member-profile-candidate.test.sh`. It creates and destroys a Unix-socket-only temporary PostgreSQL cluster with synthetic users and mock auth.uid(). It tests permissions, confirmed email, consent and age requirements, withdrawal block, normalization, idempotency, FK cleanup and a real two-session uniqueness race. It does **not** test a real Supabase instance, real email, HTTP access, signup atomicity across Supabase Auth and profile storage, or all production deletion paths.
