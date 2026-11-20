# Trusted receipt boundary — review only

This is not an API route and has no real receipt signer/verifier, authoritative
session service, distributed limiter, DB adapter, role, consent-epoch table,
nonce store, app wiring or hosted configuration. Do not deploy this candidate.

## Boundary modeled

A trusted session verifier must validate the real token and return its subject,
active session ID, email identity and verified JWT expiry. A separate trusted
receipt verifier must validate the HMAC and derive the member, session,
document version/hash/revision, receipt issue/expiry, consent generation and
nonce hash from the signed receipt and authoritative server state. A caller's
raw identity, expiry, generation or nonce must never become DB authority.

The JS service checks these results before it calls its injected adapter. This
is only an early rejection, not a commit-time guarantee: the receipt can expire,
the session can be revoked, the active documents can change, and consent can
be withdrawn while the DB call waits. A callback declaring a contract string
is not evidence that a real DB transaction enforces any of these rules.

## Required future transaction and privilege boundary

Before enabling this design, independently implement and verify all of these:

1. Revoke public, anonymous and ordinary authenticated execute rights on all
   old and new profile/consent completion functions and bypass paths. Only an
   independently scoped server-side DB role may call the new transaction. Its
   credentials must never reach the browser. A compromised/buggy trusted server
   can still forge derived parameters, so protect and audit that boundary.
2. In the same transaction and consistent lock order, match trusted user/session
   to the current Auth session, check JWT and **verified receipt** expiry against
   the DB clock after waits and before commit, and compare active document bytes'
   server-owned version/hash/revision. Whether locking Auth-managed rows is
   supported or affects refresh/logout remains to be established.
3. Store a server-owned per-member consent generation. Every consent withdrawal,
   including every existing legacy direct DELETE/RPC and member deletion path,
   must increment or invalidate that generation and remove applicable consent
   evidence atomically under the same lock. Direct/legacy paths must be disabled
   or adapted; a partial rollout cannot provide the guarantee.
4. Bind the signed receipt to that generation and a cryptographically random
   nonce. Record successful nonce consumption atomically with consent and
   profile. Define an idempotent lost-response retry that only returns existing
   completion when the exact verified request remains valid, the generation and
   consent have not changed, and the persisted profile matches. An expired or
   withdrawn receipt must not be used to recreate consent. A genuinely new
   consent must use a freshly delivered document and new verified proof.
5. Protect the evidence/nonce/epoch tables with least privilege, retention and
   deletion rules, and test existing Naver, legacy member, staff and withdrawal
   paths. Separately verify rate limits, key rotation, clock behavior, session
   renewal and the actual authoritative document publisher and displayed bytes.

The issuer currently in `member-document-receipt-candidate.mjs` does not bind a
consent generation or provide a trusted parsed DB envelope. Its plain boolean
verification cannot implement the above interface. Thus the new boundary is
not yet composable with that issuer and intentionally remains disconnected.
The old atomic SQL candidate also grants `authenticated` execute and does not
consume a receipt or compare a consent generation; it must not be exposed as a
way around the trusted boundary.

## Validation and not performed

`node --test keyword-api/src/member-trusted-receipt-boundary-candidate.test.mjs`
uses injected synthetic authorities to check normal verified request forwarding,
preflight expiration, missing/mismatched trusted results and uncertain DB
responses. It does not test real HMAC issuance, DB commit-time expiry, nonce
consumption, consent withdrawal, RLS or actual role grants.

The previously flagged exploit-reproduction and its variants were not rerun;
automatic safety review restricted that action. No claim of remediation or
production readiness follows from these synthetic boundary tests.
