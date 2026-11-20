# Document delivery receipt — isolated review candidate

This code has no HTTP route, deployed application, policy document store,
production key, DB connection or actual session verifier. It must not be
activated merely because the synthetic tests pass.

## Contract and contents

An injected authoritative document source returns one consistent, admin-owned
snapshot: terms and privacy document **exact UTF-8 bytes**, each version, and a
revision incremented whenever either document changes. Invalid UTF-8, BOM,
NUL, empty or oversized content fails closed. The service returns the exact
losslessly decoded body and hashes alongside a short-lived HMAC receipt.
The receipt payload carries only document metadata, issue/expiry timestamps
and a cryptographically random nonce. The raw document body, raw member ID,
raw session ID and access token are not stored in the receipt. The HMAC also
binds the server-verified member ID and session ID as external context.

A cryptographic receipt or signature can itself be linkable or regulated
pseudonymous information depending on context. Do not log, put it in URLs or
analytics, or assume this design by itself resolves privacy/retention duties.
A delivery receipt is not proof that a person read, understood or even saw a
document. The future UI must render the exact authoritative bytes safely,
require explicit user action and send the associated metadata/receipt. Never
render raw untrusted HTML or overwrite submitted hash/version with a newer one.

The receipt verifier validates the user's active session twice, HMAC,
expiration and current active document snapshot. The actual atomic DB write
must still independently recheck the signed gateway session, revocation,
active document revision/hash, explicit consent and profile in one transaction.
A change or logout may occur after the last preflight check; receipt validation
alone is not an authorization or concurrency boundary. `verifySession` must
validate JWT signature/issuer/audience and the correct active subject/session,
not trust request data, user metadata, or a fake test verifier.

## Deployment prerequisites and limitations

- Supply a trustworthy source that atomically binds immutable displayed bytes,
  versions, hashes and monotonic revision. The existing SQL candidate stores
  active hashes but does not provide a document publication or immutable byte
  repository. Direct admin row deletion/recreation must not allow revision reuse.
- Provide a server-side secret key manager, key IDs, rotation/retirement policy,
  cross-instance synchronization, audit and time synchronization. A retired
  key invalidates outstanding receipts. The in-memory test keys are not real.
- Receipts are replayable within their short validity interval for the same
  session and unchanged document; they are not one-time proofs. Idempotency,
  rate limits, deletion and revocation are enforced separately, not here.
- Avoid logging bearer tokens, receipt bodies, member/session identifiers or
  document payloads. Protect output/cache paths and browser data from XSS.
- Confirm existing consent consumer gates use the new immutable revision/hash
  evidence: the legacy consent table checks versions only and cannot distinguish
  same-version changed text. Confirm legacy/Naver migration policy independently.
- The profile SQL and receipt are review candidates, not validated final legal
  documents. No actual policy is published by this module.

## Validation

`node --test keyword-api/src/member-document-receipt-candidate.test.mjs`

Synthetic tests cover byte hashes, no raw member/session ID/token/body in the
receipt payload, session binding/change, tampering, valid/expired/rollback
clocks, key rotation, document updates, invalid sources and missing dependencies.
They do not test a real document publisher, production Auth, PostgREST, SQL
receipt verification, key manager, network gateway, browser accessibility, or
user understanding of the documents.
