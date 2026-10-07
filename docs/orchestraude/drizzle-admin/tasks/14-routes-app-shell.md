---
id: 14-routes-app-shell
depends_on: [06-example-app, 09-data-errors, 12-auth-session-flash-permissions, 13-auth-origin-check]
status: done
attempts: 2
---
# Task 14: routes-app-shell

## Goal
`buildApp(state)` returns the real Hono app with security headers, the static CSS route, the Origin check, the session, the current user, the CSRF token check, the dashboard / trailing-slash catch-all, the all-methods 404 fallback and `onError`. The shared integration test helper (`makeAdmin`, cookie-jar client) exists. The auth guard and login/logout are not part of this task (task 23).

## Scope
### Files to touch
- src/routes/index.ts (replace the task-05 stub)
- src/routes/middleware.ts
- src/routes/context.ts
- src/routes/dashboard.ts
- test/helpers/app.ts
- test/pages.test.ts
- test/headers.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/admin.ts, src/types.ts (except adding a missing internal type, recorded in History)
- src/auth/**, src/data/**, src/views/** (bug fixes only, recorded in History)
- test/helpers/db.ts, test/fixtures/**

## Implementation notes
- Middleware order, route table, catch-all, fallback and error handling: `interfaces/routes.md`. Context API (`AdminVars`, `requireUser`, `modelOr404`, `renderPage` with `{ minimal }`, `redirectWithFlash`): routes.md "API". Dashboard handler: `interfaces/routes-handlers.md` section "Dashboard".
- Middleware in this task, in order: securityHeaders, static route `GET /static/admin.css`, `originCheck(config.publicOrigin)`, session (anonymous session written on GET/HEAD only), user, csrfToken (POST only; body parsed once with `parseBody({ all: true })` and stored in `c.var.body`). The **authGuard (step 6) is added in task 23**, not here (test-strategy.md "Phase gates": before phase 5 the routes run without the auth guard).
- **Temporary staging (removed in task 23):** handlers need a non-null user for `can()` and `HookCtx`, but there is no login before phase 5. In builtin mode the user middleware sets `user = session.u ?? PRE_AUTH_USER`, where `PRE_AUTH_USER = { id: "pre-auth", name: "pre-auth" }` is a module constant in `middleware.ts` with a comment saying it is temporary until task 23. External mode uses `await auth.getUser(c.req.raw)` as designed. Set `showLogout: false` in the page chrome until task 23.
- Routes registered here: 1 (static), 10 (GET `/*` catch-all: `prefix + "/"` → dashboard; no trailing `/` → 301 to `path + "/" + search`; else 404) and 11 (ALL `/*` fallback → 404 page). Leave a clearly marked place between them where tasks 15, 19, 20, 21 and 23 register routes 2-9 in the table order.
- `onError`: `HTTPException` → `ErrorPage` with `err.status` (`messages.csrfFailed` for 403, else `messages.serverError`) rendered with `{ minimal: true }`; any other error → `console.error("drizzle-admin:", describeForLog(err))` when `isDbError(err)`, else `console.error("drizzle-admin:", err)`, then a minimal 500 page.
- All `Location` headers are path-only (`${prefix}/...`).
- `test/helpers/app.ts`: `makeAdmin(fixture, overrides)` sets up the fixture DB (task 08), creates an admin with `basePath: "/admin"`, a 32+ char secret, builtin `verifyCredentials` for a test user, registers the fixture tables (overridable per model and per config key), and returns `{ admin, client, db, schema, close, queryCount }`. `client` is a cookie-jar wrapper around `admin.fetch` with base `http://localhost`; it sends `Origin: http://localhost` on POST; `get(path)`, `post(path, form, { withToken = true })` (form-encoded; adds `_csrf` from `csrf()`), `csrf()` (returns the `_csrf` input value of the last HTML page; if that page has none, which is the case for the dashboard while `showLogout` is false, it decodes the `csrf` field from the `da_session` cookie in the jar, whose value is URL-encoded JSON + `.` + signature). `login()` is added in task 23.

## Definition of Done
- [ ] `src/routes/middleware.ts` contains `PRE_AUTH_USER` with a comment referencing task 23.
- [ ] Tests: `test/pages.test.ts` (`describe.each(dialects)`) verifies `GET /admin/` → 200 with `table#dashboard tr[data-model=authors]` and a `da_session` Set-Cookie; `GET /admin/static/admin.css` → 200, `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`; `GET /admin` and `GET /admin/authors/1/change?x=1` → 301 to the slashed path with the query kept; `GET /admin/a/b/c/` → 404 page with `h1`.
- [ ] Tests: `test/pages.test.ts` verifies, with the admin mounted under an outer `new Hono()` at `/admin`, that a POST with a valid token to `/admin/nope/x/y/` → 404 HTML page (layout `h1`), and `PUT /admin/authors/` without body → 404 HTML page, not the outer app's plain 404.
- [ ] Tests: `test/pages.test.ts` verifies a POST without `_csrf` → 403 page containing `messages.csrfFailed`; a POST with a correct token but `Origin: http://evil.example` → 403 HTML page containing `messages.csrfFailed` and `p.error-message`.
- [ ] Tests: `test/pages.test.ts` verifies that in external mode a throwing `getUser` → 500 page with `messages.serverError`, and a spied `console.error` received the thrown error (its message is in the logged arguments).
- [ ] Tests: `test/headers.test.ts` verifies `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` and `Cache-Control: no-store` on a 200 page, a 301 redirect, a 404 page and a 403 page, and that the static CSS response has the long-term `Cache-Control` instead of `no-store`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Dashboard", "Conventions")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (session, csrf, flash APIs used here)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (PageChrome, ErrorPage, DashboardPage)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (sections "Helpers", "Integration coverage" fallback bullet, §10 rows "Response headers", "CSRF token", "Origin check", "Phase gates")
- Decisions: docs/orchestraude/decisions/006-routing-and-mounting.md, 008-session-csrf-flash.md, 014-external-auth-csrf-token.md, 022-unmatched-routes-and-error-rendering.md
- Evidence: 2026-10-07-hono-routing-cookies-script-escaping, 2026-10-07-hono-csrf-and-jsx

## History
- Added internal type `FormBody` to src/types.ts (routes.md `AdminVars.body`; the forms task may re-export it).
- `buildApp` returns plain `Hono` (cast from the internal `Hono<AdminEnv>`), because `Admin.app` / src/admin.ts use `Hono` and cannot be changed in this task.
- `renderPage` takes either a ready element or a `(flash) => element` function; the function form is how a 200/400 page receives the flash it consumed (routes.md leaves this open). Added helpers `pageChrome` and `errorPage` in context.ts. An extra first middleware (`initVars`) sets `state`, `repo` and `body: null` so `onError` can render.
- test/register.test.ts: the fetch smoke test now requests `/admin/anything/` (the unslashed path is a 301 now); outside the Scope list but required for verify.
- Test client sends no Origin on PUT by default; `hono/csrf` treats a content-type-less PUT as a form post, so the PUT test sets `Origin: http://localhost`.
- Review fix (high): the catch-all no longer redirects when the part after the prefix starts with `//` or contains a backslash (open redirect with basePath "/"); it renders the 404 page. routes.md "301 to path + / + search" should be amended accordingly (design not touched here).
- Review fixes (low): `initVars` takes `Repository`; the Home breadcrumb is always a link except on the dashboard; CSRF tests assert `messages.csrfFailed`.

- Attempt 1: review round 1 findings (high 1, medium 0)
- Review fix round 2 (high, x2): the catch-all redirect guard is now an allowlist (`SAFE_REST`): the part after the prefix is empty or one or more `/segment` pieces with no slash, backslash, whitespace or control character in a segment. Hono percent-decodes the path, so `%09` arrived as a literal tab that browsers strip from a Location. Everything else gets the 404 page with no Location. routes.md / decision 029 should state the allowlist rule (design not touched here).

- Attempt 2: review round 2 findings (high 1, medium 0)
- Note (orchestrator): the trailing-slash guard described in the task Notes (denylist of leading `//` and backslash) is superseded by decision 029 (allowlist; also rejects whitespace and control characters). Decision 029 and interfaces/routes.md are authoritative.
