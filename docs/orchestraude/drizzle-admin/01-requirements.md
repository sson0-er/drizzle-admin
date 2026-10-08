# Requirements: drizzle-admin

Status: approved (2026-10-07)

Source: `docs/pre-specs.md` (the pre-spec). Section numbers below ("§N") refer to it. The pre-spec is part of these requirements; this document records scope, acceptance and the points agreed on top of it.

## Background and goal
Developers using Drizzle ORM have no equivalent of Django Admin. drizzle-admin is a library that produces a server-rendered CRUD admin UI (list, add, change, delete) just by registering Drizzle table definitions, customizable through Django-style options (§1).
- Intended users and distribution: open source, published on npm for any Drizzle ORM user. The package must be publishable (package metadata, MIT license with a LICENSE file, README, built output). `pnpm build` produces the publishable output. Running `npm publish`, CI and release automation are out of scope.

## Scope
Changed 2026-10-09 (scope change requested by the user after v1; the approved text below is kept as approved): the UI was Japanese only; it becomes English and Japanese. English (`en`) is the default and Japanese (`ja`) is selectable from a switcher in the header of every page and on the login page. The choice is kept only in the browser as a cookie (no DB, no session storage, no `Accept-Language` negotiation), there is no `createAdmin` option for the locale, and user-provided labels are not translated. This supersedes the out-of-scope item "i18n beyond a single Japanese messages file", which now reads "locales other than English and Japanese". Design: decisions 049-051.

### In scope
- The v1 described in the pre-spec, phases 1-6 (§13): foundation and introspection, list page, add/change, delete and actions, authentication and security, polish (FK select fallback, dark mode, responsive layout, README). All six phases are delivered in this run, in phase order.
- Public API `createAdmin` / `admin.register` / `admin.app` / `admin.fetch` with the types in §5.
- SQLite and PostgreSQL dialects (§6, §7).
- `example/` demo app (users, posts, tags) with seed data.

### Out of scope
- Everything listed in §2 (composite primary keys - rejected at registration, inlines, change history, i18n beyond a single Japanese messages file, MySQL, file uploads).
- Everything in §15 (FK autocomplete, CSV export, login rate limiting, etc.).
- Frontend frameworks and any frontend build step (§1).
- Verification on runtimes other than Node (§1).
- Running `npm publish`; CI and release automation.

## Functional requirements
1. `register()` builds a `ModelMeta` from a Drizzle table and rejects, with a descriptive error, composite primary keys, unknown column names in options, and duplicate slugs (§5.2, §6).
2. Option field names are type-checked: a nonexistent column name is a compile error (§1, §5.2).
3. Dashboard, list, add, change, delete pages and routes as in §8, with trailing-slash redirects.
4. List page: search, filters (boolean / enum / FK / date presets), header-click ordering, pagination, value formatting, bulk actions including built-in delete (§7, §8).
5. Forms: default widgets, coercion, mass-assignment protection, zod validation, user `validate`, hooks, DB-error display, PRG with flash messages, three save buttons (§9).
6. Delete confirmation; FK constraint failures shown as an error (§8).
7. Custom actions with and without a confirmation page (§5.2, §13 phase 4).
8. Authentication: built-in login via `verifyCredentials`, or external auth via `getUser` + `loginUrl`; signed-cookie sessions; logout (§10).
9. Permissions (view/add/change/delete) enforced in routes with 403 (§10).

## Non-functional requirements
- Performance: no numeric target or benchmark. Lists are paginated with `count()`-based totals (§7), and rendering a list page must not issue a query per row (no N+1, e.g. for FK display).
- Security: all items in §10 (HMAC-signed cookies, CSRF token + Origin check, open-redirect-safe `next`, escaping only via Hono JSX, security headers, permission checks in routes). No `sql.raw` with user input (§7). Lack of login rate limiting is documented in the README.
- Compatibility: Node (version from `mise.toml`, 24.x) verified; code limited to Web-standard `Request`/`Response` so other runtimes are not precluded. drizzle-orm is a peerDependency; only the latest stable release line at research time is supported (its version range is identified during research), and the dev dependency is pinned to an exact version.
- Works with JavaScript disabled except the "select all" checkbox (§11).
- TypeScript strict; `any` only at the Drizzle boundary with a reason comment (§14).
- Record keeping (overrides §14): no `NOTES.md`. Design choices, public API deviations from §5 and dependencies beyond §3 are recorded with their reasons in `docs/orchestraude/decisions/`. Ambiguities and spec contradictions are not resolved by provisional guesses; they are raised to the user.

## Acceptance criteria
- `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` all pass at the end of every phase (lint tool chosen in design).
- Introspection snapshot tests pass for SQLite and PGlite (§6).
- Integration tests listed in §12 pass, parameterized over in-memory SQLite and PGlite.
- Every item in §10 has a test.
- After all tasks are done, the user starts `example/server.ts` (run instructions provided) and confirms in a browser that login, dashboard, list, add, change, delete and actions work.
- README covers setup, every option, and known limitations.

## Open questions
- (none)
