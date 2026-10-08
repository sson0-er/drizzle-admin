---
id: 22-auth-redirect-and-login-page
depends_on: [11-views-layout-and-list-pages]
status: done
attempts: 1
---
# Task 22: auth-redirect-and-login-page

## Goal
Open-redirect-safe `next` handling and login redirect URL builders exist, and the `LoginPage` view renders the login form without echoing the password.

## Scope
### Files to touch
- src/auth/redirect.ts
- src/views/login.tsx
- test/redirect.test.ts
- test/views.test.ts (add `LoginPage` cases)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/auth/session.ts, src/auth/csrf.ts, src/auth/flash.ts, src/auth/permissions.ts
- src/routes/** (wired in task 23)
- src/views/layout.tsx (bug fixes only, recorded in History)

## Implementation notes
- `safeNext`, `loginRedirectUrl`, `externalLoginUrl`: `interfaces/auth.md#redirectts`. `safeNext` returns the normalized `pathname + search` of `new URL(next, "http://x.invalid")` only if every listed condition holds, else `${prefix}/`.
- `LoginPage({ next, username, error? })` with `PageChrome`: `form#login-form` POST to `${prefix}/login/`, `input[name=username]` with the given value, `input[name=password]` with no value attribute content, hidden `next`, hidden `_csrf`, `p.errornote` with `error` when given. Texts: `messages.login`, `messages.username`, `messages.password` (`interfaces/views.md` "Pages").

## Definition of Done
- [ ] Tests: `test/redirect.test.ts` verifies `safeNext` with prefix `/admin` accepts `/admin/`, `/admin/authors/?q=x` (returned unchanged) and normalizes `/admin/a/../b/` to `/admin/b/`; and rejects (returns `/admin/`) `undefined`, `""`, `//evil.example`, `/\evil.example`, `https://evil.example`, `/admin/../x`, `/other/`, `/admin/\u0000`, `/admin/\u007f`, `/admin/ x`, `%2F%2Fevil.example`, `/%2F%2Fevil.example`, and `/admin/\x` (a literal backslash).
- [ ] Tests: `test/redirect.test.ts` verifies `loginRedirectUrl("/admin", "/admin/authors/?q=a")` = `/admin/login/?next=%2Fadmin%2Fauthors%2F%3Fq%3Da`, and `externalLoginUrl` uses `?` for `https://sso.example/login` and `&` for `https://sso.example/login?x=1`.
- [ ] Tests: `test/views.test.ts` renders `LoginPage` and verifies `form#login-form` action `/admin/login/`, the username value kept, the password input has no non-empty `value`, hidden `next` and `_csrf` inputs, and `p.errornote` only when `error` is given.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md#redirectts
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (row `LoginPage`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "auth")
- Decisions: docs/orchestraude/decisions/008-session-csrf-flash.md

## History

- User decision after round 1 (findings passed at medium, safeNext rule adjusted per decision 032; not counted as a fix attempt)

- Attempt 1: review round 2 findings (high 0, medium 1)
