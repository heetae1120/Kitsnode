# Member auth service foundation

This is a local integration foundation, not an executable production service. `server.mjs` always fails closed. No listener, persistent deployment database, real terms, credentials, or SMTP delivery is configured. Do not deploy this directory as an authentication server.

`auth.mjs` configures Better Auth 1.7.18 for email/password, mandatory email verification, reset mail, and disabled implicit account linking. Naver is deliberately rejected: the library's Naver token request does not pass Naver's documented `state` parameter. Neither a profile fixture nor a successful authorization URL proves end-to-end compatibility.

`app.mjs` composes the auth handler and consent gate. It accepts a server-configured terms version and text, exact allowed origins, and a pre-provisioned SQLite database. It stores a SHA-256 digest for each version and refuses reuse of a version with different text; acceptances are keyed by authenticated user ID and version. This SQLite adapter is for local tests only: durable deployment, concurrency, backup and access-control requirements remain unresolved. Schema provisioning is explicit via `provisionConsentSchema`. No migration is applied to an operating database.

Local contract (all session-bearing calls require browser credentials; redirects must be limited by Better Auth trusted origins):

- `GET /api/member/terms`: `{version,text}`.
- `GET /api/member/session`: `{authenticated,consented,naverAvailable,emailAvailable}` without exposing a bearer token. Social sign-in is enabled only with an explicit server callback allowlist and requires an anonymous session.
- `POST /api/member/consent`: `{accepted:true,version}`, origin and session required; response `{ok:true}`.
- `GET /api/member/private`: synthetic protected endpoint to demonstrate enforcement, not a real member data API.
- Better Auth under `/api/auth/` for email sign-up/sign-in, logout and password recovery. Sign-up requires `termsAccepted: true` and the server `termsVersion`; the gate strips these fields before calling Better Auth. After email verification and login, the member must explicitly reconfirm the terms through the consent endpoint, which ties the record to the authenticated user. This second step avoids trusting an obfuscated duplicate-email sign-up response. Naver is unavailable.

Before any listener or production use: establish a compatible Naver callback and explicit account-link flow; finalized versioned terms and legal review; a production durable store and migration; gate every real private API; complete CSRF, redirects, CORS, rate limiting and trusted-proxy review; verify cross-site cookie restrictions and origins in real browsers; wire and test SMTP and recovery; implement deletion and account-recovery policy; set deployment secrets. All operating DB changes and deployment require separate authorization.

`npm test` runs synthetic mail and in-memory SQLite, including a loopback HTTP listener. It makes no external request and tests no real Naver, SMTP, account, or production topology. Test migration runs only against the ephemeral database. Better Auth can log its initial empty-schema and test IP warnings before the test migration.

## Isolated browser fixture

For local browser checks only, run `MEMBER_AUTH_FIXTURE=1 node fixture-server.mjs` from this directory and start the frontend at `http://127.0.0.1:4312` with `NEXT_PUBLIC_MEMBER_AUTH_URL=http://127.0.0.1:4313`. This fixture binds only `127.0.0.1:4313`, permits only that exact frontend origin, uses a fresh random session secret and in-memory SQLite, and accepts only `@example.test` addresses. The terms are explicitly synthetic and all accounts, consent and mail disappear on exit. It cannot start with `NODE_ENV=production`; the normal `npm start` remains disabled.

Synthetic verification and reset mail can be inspected from that frontend's developer console using `fetch('http://127.0.0.1:4313/__fixture/mail', {credentials:'include'}).then(r => r.json())`. Do not use real email addresses or customer data. No SMTP or external service is contacted. Naver is disabled by default; this is not a production security or Naver integration test.

For the **mocked** Naver test only, additionally set `MEMBER_AUTH_FIXTURE_NAVER=1`. The fixture replaces the authorization URL with a loopback endpoint and stubs the token and profile responses; unexpected provider fetches throw. The returned account is synthetic and still must accept the fixture terms. The normal frontend Naver button remains disabled. This option never proves real Naver compatibility and must never be used with production data or credentials.

## Real Naver login: isolated local development only

After registering a Naver development app, register callback `http://127.0.0.1:4313/api/auth/callback/naver` if Naver accepts it and add your test account. Registration acceptance and real Naver OAuth have not yet been tested. Stop the synthetic fixture on port 4313 before starting this separate harness.

From this directory, enter the app credentials directly in a local zsh terminal (do not put them in chat, source files, or command history):

For a guided prompt, run `zsh start-dev-naver.zsh`. It reads the Client ID and hidden Client Secret from the terminal and starts the same loopback server. Alternatively:

```zsh
read 'NAVER_CLIENT_ID?Naver Client ID: '
read -s 'NAVER_CLIENT_SECRET?Naver Client Secret: '; echo
export NAVER_CLIENT_ID NAVER_CLIENT_SECRET
MEMBER_AUTH_DEV_NAVER=1 node dev-naver-server.mjs
```

Open `http://127.0.0.1:4313/dev/` or the local frontend `http://127.0.0.1:4312/store/login/` with `NEXT_PUBLIC_MEMBER_AUTH_URL=http://127.0.0.1:4313` on the same computer. The frontend path receives explicitly synthetic terms and can record acceptance only in the in-memory test database. The local server does not support email/password login or sending mail. Press Ctrl+C to stop, then run `unset NAVER_CLIENT_ID NAVER_CLIENT_SECRET`. The local server requires explicit opt-in, refuses `NODE_ENV=production`, listens only on 127.0.0.1:4313, uses an in-memory database and new random secret, and deletes all test accounts and sessions on exit. It does not implement real terms, real member features or account linking. Do not use for production.

Provider access/refresh/ID tokens are stripped on account writes and token-returning APIs are disabled. The small in-memory replay cache is for a single process only; real operation needs a shared atomic store. Existing-user sessions cannot start social sign-in here, and link/unlink endpoints are not exposed. Network calls, provider behavior, browser privacy restrictions and the registered callback must still be checked with a real app. Since provider tokens are not retained, provider-side revocation after login is not provided by this harness.
