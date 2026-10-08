---
id: 30-cookie-deletion-and-head-guard
depends_on: [12-auth-session-flash-permissions, 23-login-logout-and-auth-guard, 24-security-matrix-and-proxy]
status: done
attempts: 0
---
# Task 30: cookie-deletion-and-head-guard

## Goal
Deleting the session cookie (logout) and the flash cookie (after it is shown) uses the same attributes as setting it, including `Secure` under an https `publicOrigin` or an https request URL (decision 036 item 2, L072). A logged-out HEAD request is redirected to login with the requested path and query as `next`, as GET is (decision 033 item 7, L064).

## Scope
### Files to touch
- src/auth/session.ts
- src/auth/flash.ts
- src/routes/middleware.ts
- test/session.test.ts
- test/flash.test.ts
- test/proxy.test.ts
- test/auth.test.ts
### Do not touch
- The cookie names, `maxAge` values and signing in session.ts / flash.ts
- Other middleware behavior in src/routes/middleware.ts (session issuing, CSRF token check)
- src/routes/** other than middleware.ts
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- `clearSession` (session.ts line 86) and `consumeFlash` (flash.ts line 46) currently call `deleteCookie(c, NAME, { path })` only. Pass `{ httpOnly: true, sameSite: "Lax", path: prefix || "/", secure: isSecure(c, publicOrigin) }` (auth.md `session.ts` and `flash.ts`). Hono's `deleteCookie` forwards every option to the `Max-Age=0` Set-Cookie (evidence 2026-10-08-hono-head-cookie-body-node-server).
- After this change the same security attributes appear in four places: session set and delete, flash set and delete. The CLAUDE.md duplication convention asks for a shared helper when copies must stay in sync for correctness, and it names cookie security attributes as the example. Add one helper in `src/auth/session.ts` (for example `cookieAttrs(c, prefix, publicOrigin)` returning `{ httpOnly, sameSite, path, secure }`), use it in all four places, and add `maxAge` only where a cookie is set. Record the new export in History (it is not in auth.md).
- `src/routes/middleware.ts` line 84: `next` is the requested target for `method === "GET" || method === "HEAD"`, and `${prefix}/` for other methods (routes.md "Middleware order" step 6).
- `consumeFlash` deletes the cookie whenever one was present, including an invalid one. Keep that.
- CLAUDE.md conventions apply. Put the `isSecure` table cases in an it.each.

## Definition of Done
- [ ] Every `deleteCookie` call in `src/auth/` passes `httpOnly`, `sameSite: "Lax"`, `path` and `secure` from the same source as the corresponding set call.
- [ ] Tests: `test/session.test.ts`, it.each over the four `isSecure` cases:
  - no `publicOrigin` + `http://` URL → no Secure;
  - no `publicOrigin` + `https://` URL → Secure;
  - `publicOrigin` `https://…` + `http://` URL → Secure;
  - `publicOrigin` `http://…` + `https://` URL → no Secure.
  In each case the `clearSession` Set-Cookie has `Max-Age=0`, `Path=<the test's prefix>` (e.g. `Path=/admin`), `HttpOnly` and `SameSite=Lax`, and contains `Secure` exactly in the Secure cases.
- [ ] Tests: `test/flash.test.ts`, the same table for the deletion header emitted by `consumeFlash` when a valid flash cookie is present.
- [ ] Tests: `test/proxy.test.ts`, with `publicOrigin: "https://admin.example.com"`. The GET that follows a POST setting `da_flash` emits a `da_flash` Set-Cookie with `Max-Age=0` and `Secure`. `POST /admin/logout/` emits a `da_session` Set-Cookie with `Max-Age=0` and `Secure`.
- [ ] Tests: `test/auth.test.ts`, both dialects. A logged-out `HEAD /admin/authors/?q=x` answers 302 with the same `Location` as the logged-out `GET /admin/authors/?q=x` (`/admin/login/?next=%2Fadmin%2Fauthors%2F%3Fq%3Dx`).
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (sections "`session.ts`", "`flash.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (section "Middleware order", step 6)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (auth row "cookie deletion"; §10 rows "Reverse proxy" and "Unauthenticated redirect with `next`")
- Decisions: docs/orchestraude/decisions/036-triage-behavior-changes.md (item 2), docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 7)
- Evidence: docs/orchestraude/evidence/2026-10-08-hono-head-cookie-body-node-server.md

## History
- New export not in auth.md: `cookieAttrs(c, prefix, publicOrigin)` in `src/auth/session.ts`, returning `{ httpOnly, sameSite: "Lax", path, secure }`. It is used by `writeSession`, `clearSession`, `addFlash` and `consumeFlash` (design should list it under `session.ts`).
- Removed the old header assertions in `test/session.test.ts` ("clearSession expires the cookie on the same path") and `test/flash.test.ts` ("consumeFlash deletes the cookie"); the new it.each tables cover them. The flash test is renamed "consumeFlash returns the stored message".
