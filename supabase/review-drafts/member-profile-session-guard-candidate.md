# Session-bound profile candidate — review only

This is not a migration and must not be connected to production. The prior
PostgREST local test observed that a previously issued JWT can still pass
PostgREST after Auth logout; it did not test this candidate.

The candidate requires a gateway-verified JWT, matches its `session_id` and
`sub` to a row in `auth.sessions`, rejects `not_after` and JWT `exp` expiry,
checks the existing deletion block and current consent, then completes the
profile under locks. The prior unguarded candidate's execute grant is revoked
in this isolated experiment; both functions remain non-production candidates.
It takes the existing withdrawal subject advisory lock before the session row
lock to avoid reversing the locally observed deletion lock order. A completed
profile followed by concurrent logout/withdrawal can complete first; logout and
withdrawal then finish and prevent later claims. This is not a claim that a
request already in progress is interrupted immediately when signout starts.

## Evidence and limitations

- Supabase's sessions documentation says JWT `session_id` maps to
  `auth.sessions.id` and explicit signout removes affected session rows:
  https://supabase.com/docs/guides/auth/sessions
- The tested Auth release's Session model has `id`, `user_id`, `not_after`:
  https://github.com/supabase/auth/blob/v2.198.0/internal/models/sessions.go
  The deployed managed project, grants, and exact schema/version remain
  unverified. GoTrue also uses `FOR UPDATE SKIP LOCKED` in session handling;
  `FOR SHARE` on an Auth-managed row could affect refresh/logout and must not
  be deployed without testing and supportability review.
- `not_after` and token `exp` do not implement all Supabase session policies.
  Timebox, inactivity timeout, single-session and MFA/AAL rules may be checked
  during refresh and are not captured by this candidate. A present row alone
  is not proof that all configured session restrictions remain satisfied.
- No actual JWT signature validation takes place in SQL or the local tests.
  Test `auth.jwt()` / `auth.uid()` use synthetic session variables; an exposed
  RPC requires a trusted signed JWT validation boundary and correct privileges.
- Locking session, Auth user and consent rows across a transaction changes
  concurrency and may contend with Auth refresh, signout, account deletion and
  email changes. The mock test is not a production deadlock or throughput proof.
- The Auth identity system can automatically link identities under some
  conditions when the emails match. The `raw_app_meta_data.provider='email'`
  check alone is not proof of independent provider ownership or prevention of
  automatic linking. Review actual Naver provider configuration, identity rows,
  email-verification semantics, linked email accounts and account recovery
  before using this as an authorization condition:
  https://supabase.com/docs/guides/auth/auth-identity-linking
- The candidate is not connected to the UI, an onboarding API, current-consent
  version management, global API/RLS/storage gates, or production DB. Consent
  strings are existing temporary test values, not publishable policy.

## Isolated check

`sh tests/sql/member-profile-session-guard-candidate.test.sh` creates its own
Unix-socket PostgreSQL cluster and synthetic Auth tables. It checks missing,
malformed, foreign, signed-out and expired sessions, JWT expiry, privileges,
and simultaneous profile completion, signout and withdrawal. It does not
exercise a real Supabase Auth, PostgREST, SMTP, JWT signature or hosted service.
