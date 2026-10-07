# 022: Unmatched routes, HTTPException rendering and 500 logging

- Date: 2026-10-07
- Status: accepted

## Context
Design review (low): (a) `app.notFound` of a mounted sub-app is not used, so an unmatched non-GET request would get the outer app's plain 404. (b) The Origin-check 403 from `hono/csrf` was returned as plain text, which contradicts "every error page uses the layout". (c) 500 logs only had `<kind> <name> <code>`, which hides message and stack for bugs in user callbacks.

## Decision
- (a) After the GET catch-all, register `app.all("/*", ...)`, which renders the 404 page. The handler is a route, so it travels with the sub-app when it is mounted with `app.route()`, and it also serves `admin.fetch` (whose wrapper mounts the same app). Requests outside `basePath` sent to `admin.fetch` are not admin pages and keep Hono's default 404.
- (b) In `onError`, an `HTTPException` renders `ErrorPage` with its status. The message is `messages.csrfFailed` for 403 and `messages.serverError` otherwise. Session and user may be unset at that point (the Origin check runs before the session middleware), so these pages use a minimal chrome: `user: null`, `showLogout: false`, `csrfToken: ""`, and no flash.
- (c) `onError` logs `describeForLog(err)` only when `isDbError(err)` is true: a `DrizzleQueryError` (by `instanceof`) or a string `code` anywhere in the `.cause` chain (up to 5 levels). These errors may carry bound parameters. Any other error is logged in full: `console.error("drizzle-admin:", err)`.

## Alternatives considered
- (a) Document that the mounting app must provide its own 404: leaves the admin's look inconsistent and is easy to miss.
- (b) Document that the Origin-check 403 is plain text: simpler, but inconsistent with the other 403s.
- (c) Redact everything: safe, but makes user-callback bugs hard to debug.

## Rationale
Mounted routes keep their relative paths under the mount prefix (evidence: 2026-10-07-hono-routing-cookies-script-escaping). That `notFound` is not inherited by a mounted sub-app is the reviewer's statement and is unverified here. Route (a) does not depend on it either way. `DrizzleQueryError` is exported from `drizzle-orm` and its `name` is "Error", so `instanceof` is required. Its message contains the SQL and the parameters (evidence: 2026-10-07-pg-search-non-text-columns, 2026-10-07-drizzle-driver-runtime-behavior).

## Consequences
- Tests: a POST with a valid token to an unknown path under a mounted admin → 404 HTML page. The Origin-check 403 is an HTML page containing `messages.csrfFailed`. A throwing `formatters` function is logged with its message (spy on `console.error`), while a DB error log does not contain the bound parameter value.
