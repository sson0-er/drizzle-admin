# Requirements: drizzle-admin

Status: approved (2026-10-07)

Source: `docs/pre-specs.md` (the pre-spec). Section numbers below ("§N") refer to it. The pre-spec is part of these requirements; this document records scope, acceptance and the points agreed on top of it.

## Background and goal
Developers using Drizzle ORM have no equivalent of Django Admin. drizzle-admin is a library that produces a server-rendered CRUD admin UI (list, add, change, delete) just by registering Drizzle table definitions, customizable through Django-style options (§1).
- Intended users and distribution: open source, published on npm for any Drizzle ORM user. The package must be publishable (package metadata, MIT license with a LICENSE file, README, built output). `pnpm build` produces the publishable output. Running `npm publish`, CI and release automation are out of scope.

## Scope
Changed 2026-10-09 (scope change requested by the user after v1; the approved text below is kept as approved): the UI was Japanese only; it becomes English and Japanese. English (`en`) is the default and Japanese (`ja`) is selectable from a switcher in the header of every page and on the login page. The choice is kept only in the browser as a cookie (no DB, no session storage, no `Accept-Language` negotiation), there is no `createAdmin` option for the locale, and user-provided labels are not translated. This supersedes the out-of-scope item "i18n beyond a single Japanese messages file", which now reads "locales other than English and Japanese". Design: decisions 049-051.

Changed 2026-10-09 (scope change requested by the user: release preparation; the approved text below is kept as approved): preparing the first npm publish is in scope, and CI is now in scope. This supersedes "CI" in the out-of-scope item "Running `npm publish`; CI and release automation" and in the distribution bullet above; running `npm publish` and release automation (publish jobs, version bumps, tags) stay out of scope. User decisions: the npm package name is `@sson0-er/drizzle-admin` (`drizzle-admin` is taken), published public; `repository` / `homepage` / `bugs` point at `https://github.com/sson0-er/drizzle-admin`; `hono` becomes a peerDependency (and stays a dev dependency); `package.json` declares `engines.node`, derived from what the code and dependencies need; `CHANGELOG.md` is rewritten as the 0.1.0 initial-release notes; a tarball smoke test (build, `npm pack`, install into a clean project, exercise `createAdmin` on SQLite and PGlite); a GitHub Actions workflow runs `scripts/verify.sh` on push and pull request to `main` with pinned actions, read-only permissions, node/pnpm consistent with `mise.toml`, and no publish job. Compatibility: Node 24 (mise.toml) stays the version the full suite runs on; the minimum Node version and its check are set in decision 052. Design: decision 052.

Changed 2026-10-09 (scope change requested by the user: OIDC SSO example; the approved text below is kept as approved): a second example demonstrates external auth mode (`auth.getUser` + `auth.loginUrl`) signing in through OpenID Connect with `@hono/oidc-auth`. `pnpm example:oidc` runs offline against a local mock IdP (`oidc-provider`) served over `https://localhost` with a certificate generated at run time (`selfsigned`) and trusted by Node through `NODE_EXTRA_CA_CERTS`; a real IdP can be used instead through documented `OIDC_*` variables. TLS certificate verification must never be disabled anywhere, and a test guards this. An automated vitest test drives the whole flow (unauthenticated admin request, login with `next`, IdP, callback, admin page showing the user, return to `next`, hostile `next` falling back to the admin root, logout) against the mock IdP with the real `createAdmin`, and runs in the existing CI job without network access. The README documents the example and its caveats. New devDependencies are pinned exactly and are not published; the library's public API and behavior do not change. Design: decision 053.

Changed 2026-10-10 (user answers to Q19-Q21): the OIDC example lets only users on a sign-in allowlist into the admin (denied users get a 403 page; with a real IdP and an empty allowlist it does not start; the mock IdP's demo user is allowed by default). No logout link is added to the library in external mode. Acceptance adds a post-implementation user check: the user runs `pnpm example:oidc` in Chrome or Firefox, signs in, sees the admin and signs out (not an implementer DoD item). Design: decision 053 points 12-14.

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
