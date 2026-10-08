# 042: Session and flash cookies are signed with per-instance, per-cookie derived keys; `sessionMaxAgeSec` is capped at 400 days

- Date: 2026-10-08
- Status: accepted

## Context
Security audit finding B (medium, confirmed in security-audit/verify.md): `da_session` is signed with `config.secret` alone, and hono signs only the cookie value (evidence: 2026-10-08-hono-signed-cookie-key-and-max-age). Two `createAdmin` instances that share a secret accept each other's sessions. In builtin mode this skips the target instance's `verifyCredentials`, which is privilege escalation into the other panel. `da_flash` and `da_session` are also interchangeable at the signature level; only their JSON shapes keep them apart.
A related low finding: `sessionMaxAgeSec` above 34560000 passes `createAdmin` but makes every session write throw in hono's serializer, so every page answers 500 (evidence: 2026-10-08-hono-signed-cookie-key-and-max-age).

## Decision
User decision (2026-10-08) for B and the max-age cap; the details below are the designer's.
1. Key derivation. Each cookie gets its own HMAC key: `key = HMAC-SHA256(key = UTF-8(secret), message = UTF-8(cookieName + "\0" + prefix))`, 32 bytes. `cookieName` is `da_session` or `da_flash`; `prefix` is the normalized basePath (`""` for `"/"`). The function is `deriveCookieKey(secret, cookieName, prefix): Promise<ArrayBuffer>` in `src/auth/session.ts` (Web Crypto only).
2. The keys are derived once per `buildApp`, lazily: the session middleware calls a memoized `getCookieKeys()` that creates one promise for both keys on the first request and awaits it, then stores `{ session, flash }` in the request context. Changed 2026-10-08 (design review, security-audit fix round): the first version started the promise at build time and awaited it in `initVars`; a rejection before the first request would have been an unhandled rejection, and a 500 raised in `initVars` would have bypassed `securityHeaders`. Created and awaited in the same call inside `securityHeaders`, a rejection reaches `onError` and its 500 carries the security headers. `CookieOpts.secret` and `FlashOpts.secret` are replaced by `key: ArrayBuffer`, which is passed to `getSignedCookie` / `setSignedCookie` unchanged. The raw `secret` is no longer passed to any cookie function.
3. Effect: instances with different basePaths reject each other's cookies even with the same secret, and a `da_session` value is never valid as `da_flash` (or the reverse). Instances with the same secret and the same basePath, such as replicas behind a load balancer, still share sessions, which is intended.
4. README: the `secret` row recommends a distinct secret per admin instance, separate from secrets the host uses elsewhere. The cookies table says the HMAC key is derived from `secret` and `basePath`.
5. Changelog: the new `CHANGELOG.md` (decision 048) states that upgrading signs every user out once, because cookies signed with the old key are rejected.
6. `createAdmin` rejects `sessionMaxAgeSec > 34560000` with `drizzle-admin: sessionMaxAgeSec must be a positive integer of at most 34560000 (400 days)`. The same message is used for the existing non-integer and non-positive cases.

## Alternatives considered
- Put an instance tag (the prefix) into the session payload and reject a mismatch in `parseSession`: this binds sessions but not flash, keeps session and flash interchangeable at the signature level, and changes the payload ("Session contents limited" test). The audit offered it as the second option.
- Derive keys with HKDF: the same strength here and more code; HMAC with a domain-separation label is what the audit and the user named.
- Include `publicOrigin` in the derivation: it is optional (usually `null`), so it would not separate the common case. The README advice about distinct secrets covers instances on different hosts with the same basePath.
- Clamp `sessionMaxAgeSec` silently to 400 days: hides a configuration error; every other config problem throws at `createAdmin` (admin.md).

## Rationale
hono accepts a `BufferSource` secret and imports it as a raw HMAC key, so a derived key needs no change to the cookie helpers (evidence: 2026-10-08-hono-signed-cookie-key-and-max-age). Binding the key to the cookie name and prefix separates instances and purposes without changing any payload. Deriving once per app keeps the per-request cost unchanged. hono throws for `maxAge > 34560000`, so rejecting the value at configuration time turns a site-wide 500 into a startup error (evidence: 2026-10-08-hono-signed-cookie-key-and-max-age).

## Consequences
- auth.md (`deriveCookieKey`, `CookieOpts.key`, `FlashOpts.key`), routes.md (`AdminVars.cookieKeys`, `sessionMiddleware(state, getCookieKeys)`, `cookieOpts(c)` / `flashOpts(c)`), admin.md (`sessionMaxAgeSec` rule), project-setup.md (README rows, changelog), test-strategy.md.
- Tests that sign cookies by hand must sign with the derived key.
- Every existing session and flash cookie becomes invalid once after the upgrade.
