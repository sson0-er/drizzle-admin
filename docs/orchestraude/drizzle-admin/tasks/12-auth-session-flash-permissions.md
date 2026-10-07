---
id: 12-auth-session-flash-permissions
depends_on: [05-register-and-finalize, 11-views-layout-and-list-pages]
status: pending
attempts: 0
---
# Task 12: auth-session-flash-permissions

## Goal
Signed session cookies (user, CSRF token, issue time) and signed flash cookies work, with the `Secure` flag decided by `publicOrigin` or the request scheme. Permissions are evaluated per model and user, and custom actions use the `change` permission.

## Scope
### Files to touch
- src/auth/session.ts
- src/auth/flash.ts (add `addFlash`, `consumeFlash`, `FlashOpts`; the types already exist from task 11)
- src/auth/permissions.ts
- test/session.test.ts
- test/flash.test.ts
- test/permissions.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/auth/csrf.ts, src/auth/redirect.ts (tasks 13 and 22)
- src/views/**, src/routes/**, src/admin.ts, src/types.ts

## Implementation notes
- API, cookie attributes and validation rules: `interfaces/auth.md` sections "session.ts", "flash.ts", "permissions.ts", "Data formats".
- Use `getSignedCookie` / `setSignedCookie` / `deleteCookie` from `hono/cookie`; randomness via `crypto.getRandomValues`; no `node:` imports.
- `readSession` returns `null` for: missing cookie, bad signature, malformed JSON, wrong shape (`u` null or `{ id: string, name: string }`, `csrf` non-empty string, `iat` finite number), `now - iat > maxAgeSec`, `iat > now + 60`.
- `isSecure(c, publicOrigin)`: `publicOrigin !== null ? publicOrigin.startsWith("https:") : new URL(c.req.url).protocol === "https:"`. Session and flash both use it.
- `newCsrfToken()`: 32 random bytes, base64url, 43 chars.
- `addFlash` appends to messages already set in the same response; `consumeFlash` validates the shape (invalid → `[]`) and deletes the cookie. Flash `maxAge` is 60.
- `can(model, perm, user)` calls `model.permissions[perm](user)`. `ACTION_PERMISSION = "change"` (decision 016).
- Test through a minimal Hono app (`app.request`) that calls these functions in handlers, and inspect `Set-Cookie`.

## Definition of Done
- [ ] Tests: `test/session.test.ts` verifies write → read round trip; a tampered value, a cookie signed with another secret, malformed JSON and a wrong shape → `null`; `iat` older than `maxAgeSec` → `null`; `iat` more than 60 s in the future → `null`; the decoded payload has only the keys `u`, `csrf`, `iat`; `newCsrfToken()` is 43 chars of `[A-Za-z0-9_-]`.
- [ ] Tests: `test/session.test.ts` verifies the Set-Cookie attributes `HttpOnly`, `SameSite=Lax`, `Path=<prefix>` (and `/` when prefix is `""`), `Max-Age`, and the `isSecure` table: no `publicOrigin` + `http://` URL → no `Secure`; + `https://` URL → `Secure`; `publicOrigin` `https://…` + `http://` URL → `Secure`; `publicOrigin` `http://…` + `https://` URL → no `Secure`.
- [ ] Tests: `test/flash.test.ts` verifies two `addFlash` calls in one response produce both messages, `consumeFlash` returns them and deletes the cookie, an invalid or tampered cookie → `[]`, and the `Secure` flag follows the same `isSecure` table.
- [ ] Tests: `test/permissions.test.ts` verifies `can()` for boolean `true`/`false`, a function receiving the user, the default (`true`), and `ACTION_PERMISSION === "change"`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (sections "session.ts", "flash.ts", "permissions.ts", "Data formats")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (ResolvedModel `permissions`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "auth")
- Decisions: docs/orchestraude/decisions/008-session-csrf-flash.md, 014-external-auth-csrf-token.md, 016-custom-action-permission.md, 017-public-origin.md
- Evidence: 2026-10-07-hono-routing-cookies-script-escaping

## History
