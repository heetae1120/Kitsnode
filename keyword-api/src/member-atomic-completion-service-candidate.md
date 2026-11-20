# Atomic signup completion service — isolated review candidate

This module has no route, no central document API, no real receipt issuer/verifier, no Supabase or PostgREST adapter, and no app import. It MUST NOT be wired to the application or deployed. Its passing tests use injected synthetic dependencies and cannot establish production atomicity.

## Boundary

The caller supplies a session token, member-entered profile, explicit terms/privacy/age confirmations, document versions, SHA-256 hashes, a document revision and an opaque delivery receipt. The versions attached to the user's confirmation input must exactly match the submitted document snapshot; the service rejects mismatches rather than replacing them. The service snapshots and validates the values, verifies the session through an injected trusted verifier, requires the confirmed email to match the server-verified account, requires an independently verified receipt bound to the verified user, exact session and document metadata, and compares the entire snapshot with centrally active metadata. It then calls only `atomicAdapter.complete`, passing the token, profile, document metadata and explicit confirmations. The adapter must invoke the *transactional atomic completion* DB function; the old profile functions must not be callable by users.

The receipt verifier and document reader are mandatory injected capabilities and are **not implemented**. They must validate a short-lived, integrity-protected server-issued receipt for the exact user/session, current documents, hashes and revision, based on bytes the authoritative document service actually provided. They must reject forgery, expiration and a different user/session or changed content. A receipt is not proof a person read or even visually saw a document; the future UI must fetch/display the exact verified bytes, get explicit user interaction and preserve the associated receipt. Current UI supplies only version strings and therefore MUST NOT be connected to this candidate. If these dependencies are missing or fail, the candidate fails closed.

Preflight checks cannot prevent a logout, deletion, consent withdrawal or document change immediately before the DB write. The DB transaction must itself validate the active session and current document row under appropriate locks, persist consent/evidence and create or check the profile atomically. A callback claiming `contract: member-atomic-completion-v1` is merely a dependency declaration, not security proof. Production must establish the actual implementation, enforce gateway JWT signatures, and revoke legacy RPC execution and bypasses at the DB privilege layer. `already_registered` may count as success only if the audited DB operation has verified all relevant profile fields match.

## Outcomes

- `profile_completed` only follows an explicit `created` or validated idempotent `already_registered` DB response.
- `document_unverified` means the delivery proof failed; `document_changed` means the submitted document metadata differs from central/transactional state. Neither writes through this service.
- Logout/invalid session becomes `verification_required`; username collision, existing-profile conflict and consent errors remain distinct, subject to the verified session.
- An exception, dropped response or malformed/unknown result after the atomic call is `completion_unconfirmed`: a transaction may have committed. Do not automatically retry or claim failure. Query the authenticated durable state through a separately verified route before offering recovery.
- The adapter may return a string outcome such as `unavailable` only when it has received and validated that exact result from the atomic DB function. It MUST throw on timeout, transport failure, malformed HTTP response or an ambiguous DB response; converting those cases to `unavailable` would misrepresent a possible committed write as a definite rejection. This contract has not been implemented or verified against a real adapter.

## Remaining work

Implement and audit the authoritative document storage/display/receipt flow, trusted session verifier, session-bound atomic adapter, durable distributed rate limit, current-document change policy, API authorization, UI, old-function privilege revocation and deletion/withdrawal races. Verify real browser + Supabase + PostgREST/Edge integration with the chosen provider and JWT, including exact version/hash binding. Existing final policies are not approved by this file and no document is published.

Run `node --test keyword-api/src/member-atomic-completion-service-candidate.test.mjs` for the synthetic service checks. The previous standalone atomic SQL and PostgREST tests are separate; this service has not yet been composed with the real stack.
