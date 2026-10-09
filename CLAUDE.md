# drizzle-admin

Project guide for contributors and coding agents. The full design lives in `docs/orchestraude/drizzle-admin/03-design/` and decisions in `docs/orchestraude/decisions/`.

## Overview
- ESM TypeScript library that turns registered Drizzle tables into a server-rendered, Django-admin-like CRUD UI on Hono. SQLite and PostgreSQL; English (default) and Japanese UI.
- Published on npm as `@sson0-er/drizzle-admin`; `drizzle-orm` and `hono` are peer dependencies.

## Commands
- `pnpm test` (vitest), `pnpm typecheck`, `pnpm lint` (biome), `pnpm build` (tsc to `dist/`).
- `scripts/verify.sh` runs all four in order and is the gate for every change.
- `scripts/smoke-pack.sh` packs the package, installs the tarball into a temporary project and type-checks and runs a consumer on SQLite and PGlite (needs the npm registry; not part of `verify.sh`).
- CI (`.github/workflows/ci.yml`) runs `scripts/verify.sh` and the smoke test on push and pull request to `main`; actions are pinned to commit SHAs, which Dependabot updates monthly (`.github/dependabot.yml`).
- `pnpm example` starts the demo on `127.0.0.1:3000`; override with `HOST` / `PORT`, set `ADMIN_PASSWORD` / `ADMIN_SECRET`.
- Tool versions come from `mise.toml` (`mise install`).

## Layout
- `src/introspect/`: Drizzle tables to `ModelMeta` (pg and sqlite). `src/data/`: db access, queries, repository, DB error classification.
- `src/forms/`: coercion, field and schema building, validation, widgets. `src/auth/`: session, csrf, flash, locale cookie, permissions, `safeNext`.
- `src/routes/`: Hono handlers, middleware and the language switch. `src/views/`: JSX pages. `src/static/`: CSS and the one script as TS string modules.
- `src/messages.ts` (UI strings per locale, `en` and `ja`, and the locale helpers), `src/time.ts`, `src/types.ts` (public types), `src/admin.ts` (`createAdmin`), `src/index.ts` (exports).
- `test/`: test files are named per module or concern (some modules are split, e.g. `introspect.pg`/`introspect.sqlite`), `helpers/`, `fixtures/`; DB tests run on both dialects via `describe.each(dialects)`.
- `example/`: runnable demo app. `docs/orchestraude/`: design, decisions, evidence, tasks.
- `scripts/`: `verify.sh`, `smoke-pack.sh` and the smoke consumer in `scripts/smoke/`. `.github/`: the CI workflow and `dependabot.yml`. The published package contains `dist/` and `src/`.

## Design principles
- Drizzle column internals are read only in `src/introspect/` and queries are built only in `src/data/`; the rest works on `ModelMeta` (`src/types.ts` and `src/admin.ts` import just the `Table` type).
- No frontend build: Hono JSX on the server, no bundler.
- Every UI string lives in `src/messages.ts`, in both the `en` and `ja` dictionaries (a missing key fails typecheck). Code takes texts from the request's dictionary (`c.var.t` in routes, the `t` prop or argument in views and forms), never from a module-level import or constant; user-provided labels are not translated; glyph-only literals are exempt (decision 033 item 11) and the language names live in `LOCALE_NAMES`. Developer-facing errors and log lines are English and stay out of the dictionaries.
- `src/index.ts` exports only `createAdmin` and the public types.

## Security rules
- `Location` headers are path-only and stay under the prefix (the one exception is the configured `auth.loginUrl`); post-login targets and the language switch's return target go through `safeNext`.
- Every POST passes the Origin check and the `_csrf` token check.
- Cookies are signed with keys derived per instance and per cookie (`deriveCookieKey(secret, cookieName, prefix)`, decision 042); the raw `secret` is passed to no cookie function. They are HttpOnly, SameSite=Lax and Secure per `isSecure`; set and delete share `cookieAttrs`. The exception is `da_lang`, an unsigned preference validated against the locale allow-list on read (decision 050); it still uses `cookieAttrs`.
- Every response carries the Content-Security-Policy from `buildCsp` and `X-Content-Type-Options: nosniff` (decision 044). When `SELECT_ALL_SCRIPT` changes, update `SELECT_ALL_SCRIPT_SHA256` in the same change (a test recomputes it). A new inline script, `style` attribute or external resource needs a policy change and a decision record.
- Raw DB error messages are never rendered or logged; log through `describeForLog`.
- Output is escaped by JSX; never inject raw HTML.
- Values the user may not see are not rendered (FK labels: decision 034; password values: decision 037).

## Where things live
- Design: `docs/orchestraude/drizzle-admin/03-design/` (start at `README.md`).
- Decisions: `docs/orchestraude/decisions/`. Evidence: `docs/orchestraude/evidence/`.
- Accepted low findings and adopted conventions: `docs/orchestraude/review-policy.md`.
- Task files: `docs/orchestraude/drizzle-admin/tasks/`.

## Workflow for agents
- Do not commit, push or rewrite history unless asked.
- Delete files with `gio trash`, not `rm`.
- A change that departs from the design needs a decision record first.
- Record any export or prop not in the design in the task History.
- Do not re-raise items listed in `review-policy.md`.

## Conventions
- Do not add single-use alias variables such as `const model = found`; use or rename the original binding.
- Do not keep guards, branches or throws that the preceding code already makes impossible (re-narrowing, dead fallbacks, `String()` wrappers); use a non-null assertion with a short why-comment when the type system cannot see it.
- In tests, put independent input/expected cases in an `it.each` table (one case per row) instead of for-loops or many unrelated expects in one `it`; use exact status/flash assertions, not `not.toBe(...)`.
- Do not add tests or assertions that another test in the same file already fully implies (typeof checks before a call, a regex next to an exact-message match, `not.toBe` before `toBe`).
- Small duplication (one-line helpers, option literals, JSX, test setup) in up to three places is acceptable; extract a shared helper only at the fourth copy or when the copies must stay in sync for correctness (e.g. cookie security attributes).
- Keep helpers and constants module-private unless another module imports them; any export or prop not in the design must be recorded in the task History so the design is updated.
- Stylesheet tests pin token values and the presence of key rules; selector-match precision, it.each table shape and length-only checks of literal lists in those tests are not raised in review.
