# Manual signup completion coordinator — review only

This module is not imported by the application or deployed. It reuses the existing `createMemberConsent` and `bindConsentToUser` for a verified member who explicitly re-enters their details and checks all three confirmations. It records and rereads the current terms/privacy consent, checks the session and deletion barrier again, then invokes a supplied `completeManual` operation. The server/DB completion function must still independently validate identity, email, current consent, age, username uniqueness and the deletion barrier; the coordinator never bypasses or replaces those checks.

## Required injected dependencies

- `currentSession` must synchronously report a non-reusable session-specific key and subject from a trusted session coordinator. All sign-in, callback, refresh, logout, deletion and cross-tab changes must be observed; user ID alone is insufficient.
- `verifyActiveSession` must validate the subject, session and deletion state server-side. This module does not implement it, and a stale JWT or a browser flag is not proof of an active session.
- `createConsentClient({userId,sessionKey})` must return an immutable client bound to the verified access token for exactly that user and session. A shared mutable browser client is not acceptable. Its actual DB RLS and deletion guards must prevent post-deletion writes. Those guarantees are not implemented here.
- `completeManual` must call the authenticated server/DB completion path; it must not trust this module's form values or identity. This module does not create an API or connect the candidate to existing pages.

## Important effects and failure semantics

Consent insertion and profile completion are separate operations. If consent succeeds and verification, username claiming, network delivery or session state later fails, the consent row **can remain**. If the profile request was sent but its response is lost, it may have succeeded; the coordinator returns `completion_unconfirmed` and never retries automatically. A session change suppresses a late success but cannot reverse a request already committed at the server. Check stored state and policy before offering another action. The review UI describes this uncertain state without asserting failure.

**Do not wire this candidate to the application or an operational database.** Checking the session and consent before invoking the profile API cannot atomically stop a logout, consent withdrawal or active-document version change that happens between those operations. A browser session comparison, a successful `getUser`, and an existing consent row are not sufficient proof. A production implementation must provide an independently verified transactional boundary that checks the active session, withdrawal/deletion state and authoritative current consent versions together with the profile write, and demonstrate those races under real database concurrency. The isolated coordinator tests do not provide that guarantee.

Only exact current consent versions configured by the existing module are accepted. Those versions are currently temporary in project records; this implementation does not publish documents or approve them for production. The explicit `consent_required`, `verification_required` and `profile_exists` outcomes are preserved, not converted into success or an overwrite.

## Local synthetic tests

`node --test tests/member-complete-manual-coordinator-candidate.test.mjs`

The fake scoped client exercises the real existing consent module, including consent insert followed by re-read, denied writes, stale sessions, a simulated withdrawal, concurrent submissions, input mutation and post-consent failures. One test composes it with the review-only onboarding service and mock repository. It is not a real Supabase/RLS/Storage/Auth test. It does not establish the requested production dependencies, actual callback behavior, provider linking, deployment or current policy legality.
