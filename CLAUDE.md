# drizzle-admin

Project guide for contributors and coding agents. The full design lives in `docs/orchestraude/drizzle-admin/03-design/` and decisions in `docs/orchestraude/decisions/`.

## Overview
- ESM TypeScript library that turns registered Drizzle tables into a server-rendered, Django-admin-like CRUD UI on Hono. SQLite and PostgreSQL; Japanese UI.

## Commands
- `pnpm test` (vitest), `pnpm typecheck`, `pnpm lint` (biome), `pnpm build` (tsc to `dist/`).
- `scripts/verify.sh` runs all four in order and is the gate for every change.
- `pnpm example` starts the demo on `127.0.0.1:3000`; override with `HOST` / `PORT`, set `ADMIN_PASSWORD` / `ADMIN_SECRET`.
- Tool versions come from `mise.toml` (`mise install`).

## Layout
- `src/introspect/`: Drizzle tables to `ModelMeta` (pg and sqlite). `src/data/`: db access, queries, repository, DB error classification.
- `src/forms/`: coercion, field and schema building, validation, widgets. `src/auth/`: session, csrf, flash, permissions, `safeNext`.
- `src/routes/`: Hono handlers and middleware. `src/views/`: JSX pages. `src/static/`: CSS and the one script as TS string modules.
- `src/messages.ts` (UI strings), `src/time.ts`, `src/types.ts` (public types), `src/admin.ts` (`createAdmin`), `src/index.ts` (exports).
- `test/`: test files are named per module or concern (some modules are split, e.g. `introspect.pg`/`introspect.sqlite`), `helpers/`, `fixtures/`; DB tests run on both dialects via `describe.each(dialects)`.
- `example/`: runnable demo app. `docs/orchestraude/`: design, decisions, evidence, tasks.

## Design principles
- Drizzle column internals are read only in `src/introspect/` and queries are built only in `src/data/`; the rest works on `ModelMeta` (`src/types.ts` and `src/admin.ts` import just the `Table` type).
- No frontend build: Hono JSX on the server, no bundler.
- Every UI string lives in `src/messages.ts` (glyph-only literals are exempt, decision 033 item 11).
- `src/index.ts` exports only `createAdmin` and the public types.

## Security rules
- `Location` headers are path-only and stay under the prefix (the one exception is the configured `auth.loginUrl`); post-login targets go through `safeNext`.
- Every POST passes the Origin check and the `_csrf` token check.
- Cookies are signed, HttpOnly, SameSite=Lax and Secure per `isSecure`; set and delete share `cookieAttrs`.
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
