# 014: CSRF token storage in external-auth (getUser) mode

- Date: 2026-10-07
- Status: accepted (user answer to design question Q1)

## Context
§10 requires a CSRF hidden token on every form and says the session holds user info, the CSRF token and the issue time. In external-auth mode (`auth.getUser`) there is no login, so the pre-spec does not say where the token lives.

## Decision
External mode uses the same signed `da_session` cookie as built-in mode, always with `u: null`. It holds only `csrf` and `iat`. `getUser(req)` is called on every request and stays the only source of the user; `session.u` is never written or read in external mode. Issue, expiry and token check are the same as in built-in mode (decision 008).

## Alternatives considered
- Stateless token `HMAC(secret, user.id)` with no cookie: needs no cookie, but the token never rotates or expires and a leaked token stays valid for that user indefinitely.
- A separate CSRF-only cookie: same security as the chosen option, but a second cookie and code path for no gain.

## Rationale
One code path for both auth modes (session middleware, `tokensEqual` check) and the token expires with `sessionMaxAgeSec`. The signed-cookie mechanism is the one already chosen in decision 008 (evidence: 2026-10-07-hono-routing-cookies-script-escaping). Chosen by the user (2026-10-07).

## Consequences
- The token does not rotate when the external user changes (external logout / login as someone else) until the session cookie expires. Acceptable: the token is bound to the browser cookie, and `getUser` decides the user on every request.
- Decision 008's external-auth part is resolved by this decision.
