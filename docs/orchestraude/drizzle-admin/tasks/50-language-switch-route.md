---
id: 50-language-switch-route
depends_on: [49-i18n-dictionaries-and-request-locale]
status: pending
attempts: 0
---
# Task 50: language-switch-route

## Goal
Internationalization, part 2 (decision 050 write side, decision 051 route; Q15 option (b)):
- `writeLocale` sets `da_lang=<en|ja>` with the shared `cookieAttrs` and `Max-Age=31536000`.
- `POST <prefix>/_lang/` (route 3a, both auth modes) runs after the Origin check and the `_csrf` token check. The auth guard exempts it. It writes the cookie only for a valid `lang`, and always answers `303` to `safeNext(next, prefix)`.
- `register()` rejects the slug `_lang`. The slug `lang` stays valid.

After this task a browser can switch languages by POSTing the form fields. The visible switcher comes in task 51.

## Scope
### Files to touch
- src/auth/locale.ts (add `LOCALE_MAX_AGE_SEC` and `writeLocale`)
- src/routes/lang.ts (new: `langHandler`)
- src/routes/index.ts (register route 3a only)
- src/routes/middleware.ts (`authGuard` exemption only)
- src/admin.ts (`RESERVED_SLUGS` only)
- test/locale.test.ts, test/i18n.test.ts, test/register.test.ts

### Do not touch
- `readLocale`, `initVars`, src/messages.ts (task 49)
- src/views/**, src/static/**, src/routes/context.ts, src/routes/login.ts (switcher markup and `currentUrl` are task 51)
- src/auth/{session,csrf,flash,redirect,permissions}.ts: `cookieAttrs` and `safeNext` are reused, not changed
- `clearSession` / logout: they must not touch `da_lang` (decision 050 point 5)
- Every other part of src/routes/index.ts, src/routes/middleware.ts and src/admin.ts
- src/index.ts, src/introspect/**, src/data/**, src/forms/**, example/**
- README.md, CHANGELOG.md, CLAUDE.md (task 52), package.json, biome.json, vitest.config.ts
- test/helpers/**, test/fixtures/**, every test file not listed above
- docs/** (except this task's History)
- Do not delete, weaken or skip an existing assertion. Changes to test files are new cases only.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md (one case per `it.each` row, exact status and header assertions).

- **`writeLocale`** (auth.md `locale.ts`; decision 050 points 1, 3): `export const LOCALE_MAX_AGE_SEC = 31536000` and `export function writeLocale(c, o: { prefix: string; publicOrigin: string | null }, locale: Locale): void`, which calls `setCookie(c, LOCALE_COOKIE, locale, { ...cookieAttrs(c, o.prefix, o.publicOrigin), maxAge: LOCALE_MAX_AGE_SEC })`. The cookie is not signed. Import `cookieAttrs` from `./session.js`; do not build the attributes by hand.
- **`langHandler`** (routes-handlers.md "Language switch"): `body = c.var.body ?? {}`. `lang` and `next` count only when `typeof` is `"string"`; an array (a repeated field) or a `File` counts as missing. If `isLocale(lang)`, call `writeLocale(c, { prefix, publicOrigin }, lang)` with `prefix` / `publicOrigin` from `c.var.state.config`. Then return `c.redirect(safeNext(next, prefix), 303)` in every case. It sets no flash, does not touch the session and makes no DB call. `U` may be null here, so do not call `requireUser`.
- **Route** (routes.md route table row 3a): `app.post("/_lang/", langHandler)`, registered in both auth modes after the builtin login/logout block and before `app.get("/:model/", ...)`. No GET route; `GET /_lang/` falls through to route 4 and answers 404 for a logged-in user.
- **Guard exemption** (routes.md "Middleware order" step 6, "Auth exemptions"): `authGuard` calls `next()` for `method === "POST"` and `c.req.path === \`${prefix}/_lang/\`` in both auth modes. Only POST is exempt; `GET /_lang/` while logged out is redirected to login like any page. The Origin check and the token check still run.
- **Reserved slug** (admin.md `register` step 3): add `"_lang"` to `RESERVED_SLUGS`. The error message is unchanged: `drizzle-admin: <table>: slug "_lang" is reserved`.
- **Tests** (test-strategy.md "Internationalization"; it.each, one case per row):
  - test/locale.test.ts: `writeLocale` Set-Cookie rows `[request URL, prefix, publicOrigin, expected]`:
    - `http://localhost/admin/...`, `/admin`, `null` → exactly `da_lang=ja; Max-Age=31536000; Path=/admin; HttpOnly; SameSite=Lax`, without `Secure`;
    - an `https://` URL → the same with `Secure`;
    - an `http://` URL with `publicOrigin` `https://admin.example.com` → with `Secure`;
    - prefix `""` → `Path=/`.
  - test/register.test.ts: a reserved-slug row for `_lang` (exact message), and a case in which `slug: "lang"` registers.
  - test/i18n.test.ts (both dialects; get tokens with `client.csrf()` from a page that has a `_csrf` input):
    - **Switch.** Logged in, `GET /admin/authors/?q=x`, then POST `/admin/_lang/` with `lang=ja`, `next=/admin/authors/?q=x` → 303 and `Location: /admin/authors/?q=x`. The Set-Cookie for `da_lang=ja` has `Path=/admin`, `HttpOnly`, `SameSite=Lax` and `Max-Age=31536000`. The next GET renders `html[lang=ja]`. Switching back with `lang=en` renders English.
    - **Rejections and redirects** (it.each `[body, expected Location, sets cookie]`):
      - `next` = `//evil.example`, `https://evil.example/`, `/other/`, `/admin/../x`, `/admin/..%2Fx`, or missing → `/admin/`;
      - `lang=fr` with a valid `next` → that `next`, with no `da_lang` Set-Cookie;
      - `lang` sent twice (array) → no `da_lang` Set-Cookie.

      Every `Location` starts with `/admin/`, does not start with `//`, and contains no `\`, control character or whitespace.
    - **CSRF.** POST `/admin/_lang/` without `_csrf` → 403; with a wrong token → 403; with `Origin: http://evil.example` → 403. None of them sets `da_lang`.
    - **Logged out (builtin).** GET `/admin/login/?next=%2Fadmin%2Fauthors%2F` (the login form carries the token). POST `/admin/_lang/` with `lang=ja` and `next=/admin/login/?next=%2Fadmin%2Fauthors%2F` → 303 to exactly that URL, not to the login redirect.
    - **GET routes.** Logged in, `GET /admin/_lang/` → 404. Logged out (builtin), `GET /admin/_lang/` → 302 to the login page.
    - **Slug `lang`.** A model registered with `slug: "lang"` (e.g. `kv`) still serves `GET /admin/lang/` (200) and its bulk actions at `POST /admin/lang/` (e.g. `delete_selected` without `_confirm` → 200 confirmation).
    - **Logout keeps the language** (planner-added; decision 050 point 5, not listed in test-strategy.md): after switching to `ja`, POST `/admin/logout/` sets no `da_lang` cookie, and the login page that follows has `html[lang=ja]`.
- Fails-first: write the new tests before the source change and run them on the code after task 49. Expected failures: `writeLocale` is missing; POST `/admin/_lang/` answers 404, or 302 when logged out, instead of 303 with a cookie; `_lang` registers. The `GET /admin/_lang/` and slug-`lang` cases are expected to pass on the old code too; they pin behavior the new route must not break. Record the observed failures in History.
- Expected new exports, all in the design: `LOCALE_MAX_AGE_SEC`, `writeLocale` (auth/locale.ts), `langHandler` (routes/lang.ts). Record any other export in History.

## Definition of Done
- [ ] `writeLocale` builds its attributes only through `cookieAttrs` (`grep -n "httpOnly\|sameSite" src/auth/locale.ts` finds nothing).
- [ ] src/routes/index.ts registers `app.post("/_lang/", langHandler)` outside the `authMode === "builtin"` block, before `app.get("/:model/", ...)`.
- [ ] `authGuard` exempts only `POST ${prefix}/_lang/` (in addition to the existing login exemption).
- [ ] `langHandler` calls no `addFlash` / `redirectWithFlash`, no `writeSession` / `clearSession` and no `c.var.repo` method.
- [ ] Tests (test/locale.test.ts): the four `writeLocale` Set-Cookie rows pass.
- [ ] Tests (test/register.test.ts): the `_lang` reserved row and the `lang` accepted case pass.
- [ ] Tests (test/i18n.test.ts, both dialects): Switch, Rejections and redirects, CSRF, Logged out, GET routes, Slug `lang` and Logout keeps the language cases pass.
- [ ] History records the fails-first run and states that the logout case is planner-added.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file; `git diff test/` has no removed lines.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md#`locale.ts` (decision 050)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (Language switch; Logout)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (Middleware order step 6 and "Auth exemptions"; Route table row 3a; reserved slugs paragraph; `Location` invariant)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md#`admin.register(table, options = {})` (step 3)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#Internationalization (decisions 049-051) (`locale.test.ts` writeLocale; `i18n.test.ts` Switch, rejections, CSRF, logged out, `GET /_lang/`, slug `lang`; register rows)
- Design: docs/orchestraude/drizzle-admin/03-design/questions.md (resolved Q15)
- Decisions: docs/orchestraude/decisions/050-locale-cookie.md, docs/orchestraude/decisions/051-language-switcher-post-form.md (points 1-3)
- Evidence: docs/orchestraude/evidence/2026-10-09-hono-plain-cookie-read.md, docs/orchestraude/evidence/2026-10-08-hono-signed-cookie-key-and-max-age.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
