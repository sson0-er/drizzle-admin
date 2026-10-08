---
id: 23-login-logout-and-auth-guard
depends_on: [21-routes-actions, 22-auth-redirect-and-login-page]
status: done
attempts: 0
---
# Task 23: login-logout-and-auth-guard

## Goal
Built-in login/logout work, unauthenticated requests are redirected to the login page (or `loginUrl`, or get 401 in external mode without it), the temporary pre-auth user is removed, and the shared test helper logs in by default. Sessions, CSRF token and Origin checks are verified end to end.

## Scope
### Files to touch
- src/routes/login.ts
- src/routes/middleware.ts (add authGuard as step 6; remove `PRE_AUTH_USER`)
- src/routes/index.ts (register routes 2 `GET|POST /login/` and 3 `POST /logout/` in table order)
- src/routes/context.ts (page chrome `showLogout` = builtin mode and logged in)
- test/helpers/app.ts (add `client.login()`; `makeAdmin` logs in by default, with an option to stay logged out)
- test/auth.test.ts (new)
- Existing test/*.test.ts files: only the setup lines needed to adapt to the login default (no assertion changes; list every adapted file in History)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/auth/** (bug fixes only, recorded in History), src/data/**, src/forms/**
- src/routes/list.ts, form.ts, delete.ts, actions.ts, dashboard.ts (bug fixes only, recorded in History)
- test/fixtures/**, test/helpers/db.ts

## Implementation notes
- Guard and exemptions: `interfaces/routes.md` "Middleware order" step 6 and "Auth exemptions" (`GET /static/admin.css`, `GET|POST /login/` in builtin mode). Builtin: 302 to `loginRedirectUrl(prefix, path + search)`, with `next = <prefix>/` for non-GET requests; external with `loginUrl`: 302 to `externalLoginUrl(loginUrl, path + search)`; external without `loginUrl`: 401 error page with `messages.unauthorized`. The guard runs before the token check.
- User middleware after this task: builtin → `session.u`; external → `await auth.getUser(c.req.raw)` (decision 014). `PRE_AUTH_USER` must be deleted.
- Login/logout handlers: `interfaces/routes-handlers.md` sections "Login" and "Logout". Successful login writes `newSession(user, now)` (new token) and 303s to `safeNext(next, prefix)`; failure → `LoginPage` with `messages.loginFailed`, 400, password not echoed; `GET /login/` while logged in → 302 to `safeNext`. Logout: `clearSession`, 303 to `${prefix}/login/`. In external mode `/login/` and `/logout/` → 404 (decision 013 item 8).
- `client.login()` GETs `/admin/login/`, then POSTs `username`, `password` and the page's `_csrf`.
- Tests for session expiry may craft a signed cookie with an old `iat` using `hono/cookie`'s signing with the test secret, or use fake timers.

## Definition of Done
- [ ] `grep -rn "PRE_AUTH_USER" src/ test/` finds nothing.
- [ ] Tests: `test/auth.test.ts` (`describe.each(dialects)`) verifies: logged-out `GET /admin/authors/?q=a` → 302 to `/admin/login/?next=%2Fadmin%2Fauthors%2F%3Fq%3Da`; logging in with that `next` → 303 to `/admin/authors/?q=a`; wrong password → 400 with `messages.loginFailed` and no password value in the HTML; login with `next=//evil.example`, `next=https://evil.example` and `next=/other/` → 303 to `/admin/`; logout → 303 to `/admin/login/` and the next GET of `/admin/` redirects to login; a logged-out POST → 302 with `next=%2Fadmin%2F`.
- [ ] Tests: `test/auth.test.ts` verifies a tampered `da_session` cookie and a cookie signed with another secret are treated as logged out (302 to login); a session whose `iat` is older than `sessionMaxAgeSec` → 302 to login; the decoded payload after login has only `u`, `csrf`, `iat`; Set-Cookie of `da_session` has `HttpOnly`, `SameSite=Lax`, `Path=/admin`, and `Secure` only for an `https://` request URL (no `publicOrigin`).
- [ ] Tests: `test/auth.test.ts` verifies external mode: `getUser` → null with `loginUrl` → 302 to `loginUrl` with `next`; without `loginUrl` → 401 page; `getUser` → user → 200; `/admin/login/` → 404; the first GET sets `da_session` whose payload has `u: null`; a change POST with that cookie's token → 303; without `_csrf` → 403.
- [ ] Tests: `test/auth.test.ts` verifies the CSRF token (logged in): POST without `_csrf` → 403, wrong token → 403, correct → 303; and the Origin check: correct token but `Origin: http://evil.example` → 403; no Origin and no `Sec-Fetch-Site` → 403.
- [ ] All existing integration tests pass with the login default (`scripts/verify.sh`); History lists each adapted test file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (sections "Middleware order", "Route table", "Error handling")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Login", "Logout")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "§10 test matrix" rows: Signed cookie, HttpOnly/SameSite/Secure, Session contents, Session expiry, Unauthenticated redirect, Open-redirect, External auth, CSRF token, Origin check; section "Phase gates")
- Decisions: docs/orchestraude/decisions/008-session-csrf-flash.md, 013-unspecified-page-behaviors.md (items 8, 9), 014-external-auth-csrf-token.md

## History

- Attempt 1: implemented login/logout handlers, authGuard (step 6), removed `PRE_AUTH_USER`, `showLogout`; `client.login()` and `makeAdmin` logging in by default (`login: false` stays logged out; skipped for external `getUser` configs). `client.request` forgets the last page's token when a non-HTML response issues a new `da_session` (login rotates it).
- Existing test files adapted to the login default (setup only; assertions unchanged):
  - test/form.test.ts, test/actions.test.ts, test/delete.test.ts: `adminOn` / `adminWith` use `verifyCredentials: async () => TEST_USER`, log in before returning (now async; call sites `await` them).
  - test/pages.test.ts: `freshClient` is async and logs in (`freshClient(false)` for the public stylesheet); the "session cookie on the dashboard" and "POST without a session cookie" tests use an external-auth admin, because a cookie-less request is only let through there.
  - test/register.test.ts: the `admin.fetch` test uses an external-auth admin so the 404 fallback is reachable without login.
  - test/example.test.ts: phases 2 and 3 log in (`admin` / `x`) through the cookie-jar client instead of `app.request`.
- Not adapted, no change needed: test/list.test.ts, test/headers.test.ts.
