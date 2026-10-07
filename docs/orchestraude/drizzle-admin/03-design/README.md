# Design: drizzle-admin

## Overview
drizzle-admin is an ESM TypeScript library that turns registered Drizzle tables into a server-rendered, Django Admin-like CRUD UI. `createAdmin(config)` returns an `Admin`. `register(table, options)` introspects each table into a `ModelMeta` (the only representation downstream code uses) and validates the options. On first access, `admin.app` / `admin.fetch` lazily build a Hono app with relative routes, to be mounted at `basePath`. Requests flow through security middleware (headers, `hono/csrf`, signed-cookie session, auth guard, CSRF token) into page handlers. Handlers use a dialect-aware repository (Drizzle query builder only) and the forms pipeline (coerce → zod → user validate → hooks → DB), and render Hono JSX views. The repository uses `.returning()`. Tooling: pnpm 12.10.0 via mise, TypeScript 7 + tsc build, vitest 5, Biome. Tests run against in-memory SQLite and PGlite.

Pre-spec references "§N" point to `docs/pre-specs.md`. The pre-spec remains normative except where a decision in `docs/orchestraude/decisions/` says otherwise.

## Components and responsibilities
| Component | Responsibility | Depends on | Interface file |
|---|---|---|---|
| admin (public API) | Public types, `createAdmin`, `register` validation, option defaults (`ResolvedModel`), registry finalization, `admin.app` / `admin.fetch` | introspect, routes, support | interfaces/admin.md |
| introspect | Drizzle table → `ModelMeta` / `FieldMeta`; the only code touching Drizzle column internals | drizzle-orm | interfaces/introspect.md |
| data | Repository (list/count/get/getMany/create/update/delete/options), query-condition builders, DB error classification | introspect types, support/time, drizzle-orm | interfaces/data.md |
| forms | Form field layout, widget choice, coercion, zod schema, validation pipeline, widget rendering | introspect types, admin types, support | interfaces/forms.md |
| auth | Session cookie, CSRF token check, flash cookie, safe `next`, login redirects, permission evaluation | hono/cookie, hono/csrf | interfaces/auth.md |
| routes | Hono app assembly: middleware chain, every page/handler in §8, actions, PRG | admin, data, forms, auth, views | interfaces/routes.md, interfaces/routes-handlers.md |
| views | Hono JSX pages, cell formatting, CSS module, select-all script | support, forms (widgets) | interfaces/views.md |
| support | `messages.ts` (all Japanese UI strings), `time.ts` (time-zone math) | none | interfaces/support.md |
| project setup | package.json, tsconfig, Biome, vitest config, scripts, LICENSE, README content | none | interfaces/project-setup.md |
| example | `example/` demo app (users, posts, tags), seed, server, run instructions | public API | interfaces/example.md |

Source layout (§4 plus additions from decisions 006, 007 and this design):
```
src/index.ts  src/types.ts  src/admin.ts  src/messages.ts  src/time.ts
src/introspect/{index,sqlite,pg}.ts
src/data/{repository,query,errors,db}.ts
src/forms/{fields,coerce,schema,validate}.ts  src/forms/widgets.tsx
src/auth/{session,csrf,flash,redirect,permissions}.ts
src/routes/{index,middleware,context,dashboard,list,actions,form,delete,login}.ts
src/views/{layout,dashboard,list,form,delete,confirm-action,login,error}.tsx  src/views/{format,render,url}.ts
src/static/admin-css.ts  src/static/select-all.ts
example/{schema,seed,app,server}.ts
test/...
```

## Data flow
Changed 2026-10-07: Origin check and cookie `Secure` flag follow `AdminConfig.publicOrigin` when set (decision 017); external mode keeps the CSRF token in the same session cookie (decision 014).

1. Setup: `createAdmin(config)` validates config → `admin.register(table, opts)` → `introspectTable(table, dialect)` → `ModelMeta` → option validation → `ResolvedModel` stored by slug.
2. First access of `admin.app` / `admin.fetch` → `finalize()` resolves `foreignKey.slug`, validates cross-model options, freezes the registry → `buildApp(adminState)` creates the Hono app.
3. Request: security headers (wrap) → static CSS route (no auth) → `hono/csrf` Origin check (unsafe form posts; expected origin = `publicOrigin` if configured, else the request URL origin) → session load/issue (signed cookie, `Secure` per `publicOrigin` or request scheme; `u: null` in external mode) → resolve user (session or `getUser`) → auth guard (redirect to login / `loginUrl`) → POST `_csrf` token check → handler.
4. Handler: resolve model by slug (404) → permission check (403) → parse query/body → repository and forms → either render HTML (200 / 400) via `renderPage`, or set flash + 303 redirect (PRG).
5. List rendering: one count query, one page query, one batched `getMany` per FK column shown, and option queries per FK filter. The number of queries does not depend on the row count (no N+1).

## Error handling
Changed 2026-10-07: unmatched paths of any method, the Origin-check 403 page and 500 logging (decision 022); PG search cast and date-only values (decisions 018, 019).
Changed 2026-10-07: date-only strings for PG `date()` string mode (decision 023).

- Configuration errors (`createAdmin`, `register`, finalization): throw `Error` with message prefix `drizzle-admin: ` naming the table/option/key. Never deferred to request time.
- Unknown model slug, invalid or unknown primary key → 404 HTML page.
- Unmatched path with any method → 404 HTML page via an explicit all-methods fallback route, which also works when `admin.app` is mounted.
- Missing permission → 403 HTML page. Missing/invalid CSRF token or failed Origin check → 403 HTML page (layout, `messages.csrfFailed`).
- Unauthenticated → 302 redirect to `<prefix>/login/?next=...` (built-in) or `loginUrl?next=...` (external); external without `loginUrl` → 401.
- Form problems (coercion, zod, `validate`, DB constraint, `beforeSave` failure) → 400 with the form re-rendered, raw submitted values kept, field and form-level errors shown.
- Delete/action failures (FK violation, hook/action throw) → error flash + 303 to list.
- DB errors are classified by code (decision 011); raw messages are never rendered. Unexpected errors → `app.onError` → 500 generic page + `console.error`: redacted (`describeForLog`) for DB errors, full error otherwise.
- Configurations that used to fail at query time are prevented: PG search casts every column to text (decision 018), and incompatible widget overrides are rejected by `register()` (decision 021).
- Date-only values (PG `date({mode:"date"})`) are UTC-midnight calendar dates everywhere, so the configured time zone never shifts the stored day (decision 019).
- Date-only strings (PG `date()` string mode) stay `YYYY-MM-DD` strings everywhere; malformed or impossible dates are rejected by coercion as `invalidDate` instead of reaching the DB (decision 023).

## Index
Changed 2026-10-07: questions and decisions summaries updated for Q1-Q4, then for the review revision (decisions 018-022, Q5).
Changed 2026-10-07: Q5 answered (decision 023).

| File | Summary |
|---|---|
| README.md | This overview: components, layout, data flow, error handling |
| interfaces/admin.md | Public API types (§5.2 plus additions), createAdmin/register validation, ResolvedModel, finalization |
| interfaces/introspect.md | `introspectTable`, ModelMeta/FieldMeta, kind and flag mapping, PK/FK rules, snapshot projection |
| interfaces/data.md | Repository API, query builders (search/filter/order/pk parsing), DB error classification, Drizzle boundary |
| interfaces/forms.md | Form field layout, widget defaults, coercion rules, zod schema, validation pipeline, widget rendering |
| interfaces/auth.md | Session/flash cookies, CSRF check, safe `next`, login redirects, permission helper |
| interfaces/routes.md | App assembly: AdminVars context, middleware order, route table, catch-all, error handling |
| interfaces/routes-handlers.md | Per-page handler behavior: dashboard, list, actions, add/change (PRG, hooks), delete, login/logout |
| interfaces/views.md | JSX page components and their props, stable selectors for tests, cell formatting, CSS and script modules |
| interfaces/support.md | `messages.ts` structure and required keys, `time.ts` functions (time-zone math, UTC calendar dates for date-only values) |
| interfaces/project-setup.md | package.json, tsconfig(s), biome.json, vitest config, scripts, LICENSE, README outline |
| interfaces/example.md | Example schema, seed, server, and run instructions for the user's browser check |
| test-strategy.md | Tests per component, dialect parameterization, helpers, §10 test matrix, phase gates |
| questions.md | Open: none; resolved: pnpm provisioning, Q1-Q5, hono/csrf origin equality proven by test |
| decisions-and-evidence.md | Decisions 001-023 and evidence ids referenced by this design |
