# 008: Session, CSRF token and flash cookies

- Date: 2026-10-07
- Status: accepted (external-auth part resolved by decision 014; reverse-proxy consequence addressed by decision 017)

## Context
§10: HMAC-SHA256 signed cookie sessions via Web Crypto, contents limited to user info, CSRF token and issue time, a CSRF hidden token on every form plus an Origin check via `hono/csrf`. The login form is also a POST and needs a token before anyone is logged in. Flash messages (§9 PRG) need storage.

## Decision
- Session cookie `da_session`: signed with `setSignedCookie`/`getSignedCookie` from `hono/cookie` using `config.secret`. Payload JSON `{ "u": AdminUser | null, "csrf": string, "iat": number }`. `HttpOnly`, `SameSite=Lax`, `Path=<basePath or />`, `Max-Age=sessionMaxAgeSec`, and `Secure` when the request URL scheme is https (or, when `AdminConfig.publicOrigin` is set, when that origin is https; decision 017).
- An anonymous session (`u: null`) is issued on any GET without a valid session, so the login form has a token. Successful login issues a fresh session with a new token (fixation protection). Logout deletes the cookie.
- Expiry is fixed: invalid when `now - iat > sessionMaxAgeSec` (no sliding renewal).
- CSRF: `hono/csrf` (defaults) runs on every request, and every POST must carry `_csrf` equal to the session token, compared in constant time; otherwise 403.
- Flash: a separate signed cookie `da_flash` holding a JSON array of `{ level, text }`, set on redirect and consumed (deleted) on the next rendered page. It is not part of the session, so the session stays limited to user, token and issue time.
- External auth (`getUser`): the same session cookie with `u: null` holds the token, while `getUser(req)` stays the source of the user (decision 014).

## Alternatives considered
- Hand-written HMAC with `crypto.subtle`: the same algorithm, more code to get right.
- Stateless CSRF token = HMAC(secret, user id): no cookie needed in external mode, but the token never rotates and the login form has no user.
- Flash inside the session cookie: violates the §10 content restriction.

## Rationale
`hono/cookie` provides HMAC-SHA256 signed cookies through Web Crypto; a tampered value reads as `false` (evidence: 2026-10-07-hono-routing-cookies-script-escaping). `hono/csrf` passes when Sec-Fetch-Site is same-origin or Origin matches, and rejects requests with neither (evidence: 2026-10-07-hono-csrf-and-jsx). The hidden token is therefore needed in addition to it.

## Consequences
- Behind a TLS-terminating reverse proxy, the request URL may be http: Secure is then not set and `hono/csrf`'s origin may mismatch. Addressed by `AdminConfig.publicOrigin` (decision 017).
- Changed 2026-10-08: the session and flash cookies are signed with keys derived from `secret`, the cookie name and the prefix instead of `secret` itself, and `sessionMaxAgeSec` is capped at 34560000 (decision 042).
