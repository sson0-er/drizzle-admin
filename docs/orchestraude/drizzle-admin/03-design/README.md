# Design: drizzle-admin

## Overview
drizzle-admin is an ESM TypeScript library that turns registered Drizzle tables into a server-rendered, Django Admin-like CRUD UI. `createAdmin(config)` returns an `Admin`. `register(table, options)` introspects each table into a `ModelMeta` (the only representation downstream code uses) and validates the options. On first access, `admin.app` / `admin.fetch` lazily build a Hono app with relative routes, to be mounted at `basePath`. Requests flow through security middleware (headers, `hono/csrf`, signed-cookie session, auth guard, CSRF token) into page handlers. Handlers use a dialect-aware repository (Drizzle query builder only) and the forms pipeline (coerce → zod → user validate → hooks → DB), and render Hono JSX views. The repository uses `.returning()`. Tooling: pnpm 12.10.0 via mise, TypeScript 7 + tsc build, vitest 5, Biome. Tests run against in-memory SQLite and PGlite.

Changed 2026-10-09: the UI is English (default) and Japanese. The locale comes from the browser's `da_lang` cookie, is resolved first in every request and reaches handlers as `c.var.t` and views as the `t` prop; a POST form in the header switches it (decisions 049-051).

Changed 2026-10-09: release preparation (decision 052): the package is published as `@sson0-er/drizzle-admin` with `drizzle-orm` and `hono` as peers and `engines.node` `>=22`; a tarball smoke test and a GitHub Actions workflow (verify gate plus smoke test on Node 24 and 22) are added. The product name stays "drizzle-admin".

Changed 2026-10-09: OIDC SSO example (decision 053): a second demo, `pnpm example:oidc`, signs in through OpenID Connect with `@hono/oidc-auth` in external auth mode, against a local `oidc-provider` mock IdP on `https://localhost` (run-time certificate trusted through `NODE_EXTRA_CA_CERTS`, TLS verification never disabled) or a real IdP; a vitest test drives the whole flow in CI. The library itself does not change.

Pre-spec references "§N" point to `docs/pre-specs.md`. The pre-spec remains normative except where a decision in `docs/orchestraude/decisions/` says otherwise.

## Components and responsibilities
Changed 2026-10-08: views also own the fixed icon set, `src/views/icons.tsx` (decision 039).
Changed 2026-10-08: the stylesheet has its own interface file, views-style.md (DADS-inspired restyle, decision 040).
Changed 2026-10-08: security audit fixes (decisions 042-048): forms uses data's pure `parseFieldValue`; the example gains `host-guard.ts`; project setup gains `CHANGELOG.md` and a `prepack` build.
Changed 2026-10-09: internationalization (decisions 049-051): support holds the `en` / `ja` dictionaries; auth owns the `da_lang` cookie (`locale.ts`); routes resolve the locale in `initVars` and add the language switch route (`lang.ts`); views render `<html lang>` and the header switcher; forms take the dictionary as an argument.
Changed 2026-10-09: release preparation (decision 052): project setup gains the scoped name, peers, `engines` and the 0.1.0 changelog; new component "release checks" (tarball smoke test, CI workflow).
Changed 2026-10-09: OIDC example (decision 053): new component "example OIDC"; example gains `createExampleAdmin`; project setup gains the `example:oidc` script, four dev dependencies and the vitest `pool` / `globalSetup`.

| Component | Responsibility | Depends on | Interface file |
|---|---|---|---|
| admin (public API) | Public types, `createAdmin`, `register` validation, option defaults (`ResolvedModel`), registry finalization, `admin.app` / `admin.fetch` | introspect, routes, support | interfaces/admin.md |
| introspect | Drizzle table → `ModelMeta` / `FieldMeta`; the only code touching Drizzle column internals | drizzle-orm | interfaces/introspect.md |
| data | Repository (list/count/get/getMany/create/update/delete/options), query-condition builders, DB error classification | introspect types, support/time, drizzle-orm | interfaces/data.md |
| forms | Form field layout, widget choice, coercion, zod schema, validation pipeline, widget rendering | introspect types, admin types, support, data (`parseFieldValue` only) | interfaces/forms.md |
| auth | Session cookie, CSRF token check, flash cookie, locale cookie `da_lang`, safe `next`, login redirects, permission evaluation | hono/cookie, hono/csrf, support (`Locale`, `isLocale`, `DEFAULT_LOCALE`) | interfaces/auth.md |
| routes | Hono app assembly: middleware chain (incl. locale resolution), every page/handler in §8, actions, PRG, language switch | admin, data, forms, auth, views, support | interfaces/routes.md, interfaces/routes-handlers.md |
| views | Hono JSX pages, cell formatting, decorative icon set, CSS module, select-all script | support, forms (widgets) | interfaces/views.md, interfaces/views-style.md (stylesheet) |
| support | `messages.ts` (all UI strings, one dictionary per locale `en` / `ja`, locale helpers), `time.ts` (time-zone math) | none | interfaces/support.md |
| project setup | package.json (name, peers, engines, publish access), tsconfig, Biome, vitest config, scripts, LICENSE, README content, CHANGELOG | none | interfaces/project-setup.md |
| release checks | Tarball smoke test (`scripts/smoke-pack.sh`, `scripts/smoke/`), the CI workflow `.github/workflows/ci.yml` and `.github/dependabot.yml` (action pins); no publishing | project setup (package.json, `scripts/verify.sh`), public API | interfaces/release-checks.md |
| example | `example/` demo app (users, posts, tags), seed, shared admin builder `createExampleAdmin`, server, Host check, run instructions | public API | interfaces/example.md |
| example OIDC | `example/oidc/`: OIDC sign-in demo (getUser bridge, sign-in allowlist with 403 page, login route validating `next`, callback, logout, landing page), environment parsing, mock IdP, run-time localhost certificate, launcher; README "OIDC example" text | example (`createExampleAdmin`, `hostGuard`), public API, `@hono/oidc-auth`, `oidc-provider`, `selfsigned` | interfaces/example-oidc.md |

Source layout (§4 plus additions from decisions 006, 007 and this design):
```
src/index.ts  src/types.ts  src/admin.ts  src/messages.ts  src/time.ts
src/introspect/{index,sqlite,pg}.ts
src/data/{repository,query,errors,db}.ts
src/forms/{fields,coerce,schema,validate}.ts  src/forms/widgets.tsx
src/auth/{session,csrf,flash,redirect,permissions,locale}.ts
src/routes/{index,middleware,context,dashboard,list,actions,form,delete,login,lang}.ts
src/views/{layout,dashboard,list,form,delete,confirm-action,login,error,icons}.tsx  src/views/{format,render,url}.ts
src/static/admin-css.ts  src/static/select-all.ts
example/{schema,seed,app,host-guard,server}.ts  CHANGELOG.md
example/oidc/{cert,mock-idp,return-path,allowlist,mode,config,server,launch}.ts  example/oidc/app.tsx  test/helpers/oidc-global-setup.ts
scripts/{verify,smoke-pack}.sh  scripts/smoke/{consumer.ts,tsconfig.json}  .github/workflows/ci.yml  .github/dependabot.yml
test/...
```

## Data flow
Changed 2026-10-07: Origin check and cookie `Secure` flag follow `AdminConfig.publicOrigin` when set (decision 017); external mode keeps the CSRF token in the same session cookie (decision 014).
Changed 2026-10-08: cookie keys derived per instance (decision 042), CSP and nosniff headers (decision 044), hidden models (decision 043), safe external `next` (decision 047).

1. Setup: `createAdmin(config)` validates config → `admin.register(table, opts)` → `introspectTable(table, dialect)` → `ModelMeta` → option validation → `ResolvedModel` stored by slug.
2. First access of `admin.app` / `admin.fetch` → `finalize()` resolves `foreignKey.slug`, validates cross-model options, freezes the registry → `buildApp(adminState)` creates the Hono app, builds the CSP string once and prepares a memoized derivation of the session and flash signing keys from `secret`, cookie name and prefix, run on the first request (decisions 042, 044).
3. Request: context init (Changed 2026-10-09: also `locale` from the `da_lang` cookie, `en` when missing or invalid, and its dictionary `t`; decisions 049, 050) → security headers (wrap; incl. CSP and `nosniff`) → static CSS route (no auth) → `hono/csrf` Origin check (unsafe form posts; expected origin = `publicOrigin` if configured, else the request URL origin) → session load/issue (awaits the derived cookie keys; signed cookie, `Secure` per `publicOrigin` or request scheme; `u: null` in external mode) → resolve user (session or `getUser`) → auth guard (redirect to login / `loginUrl` with a `safeNext` target) → POST `_csrf` token check → handler.
4. Handler: resolve model by slug (404, also for a model with no permission for the user) → permission check (403) → parse query/body → repository and forms → either render HTML (200 / 400) via `renderPage` (function form receiving the consumed flash, decision 027), or set flash + 303 redirect (PRG).
5. List rendering: one count query, one page query, one batched `getMany` per FK column shown, and option queries per FK filter. The number of queries does not depend on the row count (no N+1).

## Error handling
Changed 2026-10-07: unmatched paths of any method, the Origin-check 403 page and 500 logging (decision 022); PG search cast and date-only values (decisions 018, 019).
Changed 2026-10-07: date-only strings for PG `date()` string mode (decision 023).
Changed 2026-10-08: the trailing-slash redirect never leaves the prefix (decision 029).
Changed 2026-10-08: allowlist instead of denylist after a tab-character bypass (decision 029).
Changed 2026-10-08: whitespace excluded from the allowlist; decoded LF/CR 404 accepted as a known limitation (decision 029, former Q6).
Changed 2026-10-08: vanished rows on delete and actions, non-DB errors on create/update, FK labels gated by `view` on the referenced model, password values never rendered (decisions 033, 034, 036, 037).
Changed 2026-10-08: security audit fixes: hidden models are 404, input outside DB domains and oversized selections are not 500s, search text capped, `sessionMaxAgeSec` capped, excluded columns kept out of the default list (decisions 042, 043, 045, 046).

Changed 2026-10-09: error pages and flash texts are in the request's locale; minimal pages have no switcher; configuration errors and logs stay English (decisions 049, 051).

- Configuration errors (`createAdmin`, `register`, finalization): throw `Error` with message prefix `drizzle-admin: ` naming the table/option/key. Never deferred to request time. They are English in every locale (developer-facing, decision 049 point 6).
- Every rendered page, error pages included, uses the request's dictionary `c.var.t`, which `initVars` sets before any other middleware, so even the Origin-check 403 and `onError` 500 pages follow `da_lang`. Those minimal pages show no language switcher (no CSRF token there, decision 051). A `da_lang` value other than `en` / `ja` is treated as absent (English), never as an error (decision 050).
- Language switch (`POST <prefix>/_lang/`): an unknown `lang` writes no cookie; the redirect always goes to `safeNext(next, prefix)`; missing token or failed Origin check → 403 like every POST (decision 051).
- Unknown model slug, invalid or unknown primary key → 404 HTML page. A registered model on which the user has none of `view` / `add` / `change` / `delete` answers the same 404 on every model route, so its name is not revealed (decision 043). A primary key outside the column's DB domain (PG int2/int4/int8 range, non-uuid string for a uuid key, NUL character, value not in an enum) is an invalid key → 404; such an FK filter value is ignored and such `_selected` ids are skipped (decision 045).
- Unmatched path with any method → 404 HTML page via an explicit all-methods fallback route, which also works when `admin.app` is mounted.
- Unslashed GET path → 301 to the slashed path only when the path after the prefix is empty or a `/segment/...` shape with non-empty segments and no `\`, control character or whitespace (allowlist); anything else → 404 without `Location`, so no `Location` can point off-site, including with `basePath: "/"` (decision 029). Known limitation: paths with a decoded LF/CR never reach the admin routes, so they get Hono's (or the host's) plain 404 without `Location` and without the admin's security headers (decision 029).
- Missing permission on a model that grants the user at least one permission → 403 HTML page. Unset `add` / `change` / `delete` follow `view` (decision 043). Missing/invalid CSRF token or failed Origin check → 403 HTML page (layout, `messages.csrfFailed`).
- Unauthenticated → 302 redirect to `<prefix>/login/?next=...` (built-in) or `loginUrl?next=...` (external); external without `loginUrl` → 401.
- Form problems (coercion, zod, `validate`, DB constraint, `beforeSave` failure) → 400 with the form re-rendered, raw submitted values kept, field and form-level errors shown.
- More than 500 selected ids for a bulk action → warning flash `tooManySelected` + 303 back, no query (decision 045). The search text has NUL characters removed and is cut to 200 code points (decision 045).
- Delete/action failures (FK violation, hook/action throw) → error flash + 303 to list. Rows that vanished concurrently: bulk delete or a confirm action with no surviving rows → `noSelection` warning + 303; a single delete that removes 0 rows → `alreadyDeleted` warning + 303 (decisions 033, 036).
- Non-DB errors thrown by `repo.create` / `repo.update` are not form errors: they go to `onError` → 500 (decision 033).
- Information the user may not see is not rendered: FK labels, links, filters and select choices of a referenced model need `view` on it (decision 034); `password`-widget values never appear in the HTML: inputs render empty, display-only fields and list cells show `********` (decision 037).
- DB errors are classified by code (decision 011); raw messages are never rendered. Unexpected errors → `app.onError` → 500 generic page + `console.error`: redacted (`describeForLog`) for DB errors, full error otherwise.
- `listPerPage` above 500 throws at `register()`, so a full page always fits the bulk-selection cap (decision 045 point 5).
- `sessionMaxAgeSec` above 34560000 throws at `createAdmin`, because hono refuses to write such a cookie and every page would answer 500 (decision 042).
- Configurations that used to fail at query time are prevented: PG search casts every column to text (decision 018), and incompatible widget overrides are rejected by `register()` (decision 021).
- Date-only values (PG `date({mode:"date"})`) are UTC-midnight calendar dates everywhere, so the configured time zone never shifts the stored day (decision 019).
- Date-only strings (PG `date()` string mode) stay `YYYY-MM-DD` strings everywhere; malformed or impossible dates are rejected by coercion as `invalidDate` instead of reaching the DB (decision 023).

## Project rules affected (Changed 2026-10-09, decision 049 point 12)
A task updates `CLAUDE.md` accordingly. Changed 2026-10-09 (design review, i18n round): this section is the canonical text the task copies; decision 049 point 12 points here.
- Overview: "Japanese UI" becomes "English (default) and Japanese UI".
- Layout: `src/messages.ts` holds the UI strings per locale (`en`, `ja`) and the locale helpers; `src/auth/` also holds the locale cookie; `src/routes/` also holds the language switch.
- Design principles: "Every UI string lives in `src/messages.ts`" becomes "Every UI string lives in `src/messages.ts`, in both the `en` and `ja` dictionaries (a missing key fails typecheck). Code takes texts from the request's dictionary (`c.var.t` in routes, the `t` prop or argument in views and forms), never from a module-level import or a module-level constant; user-provided labels are not translated; glyph-only literals are exempt (decision 033 item 11) and the language names live in `LOCALE_NAMES`. Developer-facing errors and log lines are English and stay out of the dictionaries."
- Security rules: "Cookies are signed ..." gains "except `da_lang`, an unsigned preference validated against the locale allow-list on read (decision 050); it still uses `cookieAttrs`". "`Location` headers are path-only ..." gains the language switch next to the post-login target as a `safeNext` user.

## Project rules affected (Changed 2026-10-09, decision 052)
The release-preparation task updates `CLAUDE.md` with this text:
- Overview: add "Published on npm as `@sson0-er/drizzle-admin`; `drizzle-orm` and `hono` are peer dependencies."
- Commands: add "`scripts/smoke-pack.sh` packs the package, installs the tarball into a temporary project and type-checks and runs a consumer on SQLite and PGlite (needs the npm registry; not part of `verify.sh`)." and "CI (`.github/workflows/ci.yml`) runs `scripts/verify.sh` and the smoke test on push and pull request to `main`; actions are pinned to commit SHAs, which Dependabot updates monthly (`.github/dependabot.yml`)."
- Layout: add "`scripts/`: `verify.sh`, `smoke-pack.sh` and the smoke consumer in `scripts/smoke/`. `.github/`: the CI workflow and `dependabot.yml`. The published package contains `dist/` and `src/`."

## Project rules affected (Changed 2026-10-09, decision 053)
The OIDC example task updates `CLAUDE.md` with this text:
- Commands: add "`pnpm example:oidc` starts the OIDC sign-in demo: with no `OIDC_ISSUER` it also starts a local mock IdP on `https://localhost:3001` (open `http://localhost:3000/admin/`, sign in as `demo`); for a real IdP set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_ALLOWED_SUBJECTS` or `OIDC_ALLOWED_EMAIL_DOMAINS` (Changed 2026-10-10: allowlist, Q21)."
- Layout: add "`example/oidc/`: the OIDC demo (`@hono/oidc-auth`, mock IdP `oidc-provider`, run-time certificate, launcher)."
- Security rules: add "TLS certificate verification is never disabled, in code, tests, scripts or CI: the mock IdP is trusted only through `NODE_EXTRA_CA_CERTS` with a certificate generated at run time. `test/tls-verification.test.ts` fails on the names that would disable it (the one allowed occurrence is the refusal check in `example/oidc/mode.ts`), and `test/example-oidc.test.ts` proves in the flow's worker that an untrusted certificate is still rejected." (Changed 2026-10-10, design review.)
- Security rules (Changed 2026-10-10, design review): "Every POST passes the Origin check and the `_csrf` token check" becomes "Every POST to the admin (`src/`) passes the Origin check and the `_csrf` token check. The OIDC example's `POST /oidc/logout` is Origin-checked only (decision 053 point 7)."

## Index
Changed 2026-10-10: OIDC design review (decision 053 points 2, 3, 6, 7, 15): example-oidc.md (`mode.ts`, explicit settings, callback 400, exact texts, mount warning), test-strategy (negative control, wider guard), project rules for decision 053 updated.
Changed 2026-10-10: Q19-Q21 answered (decision 053 points 12-14): example-oidc.md (allowlist, `config.ts`), test-strategy, questions and decisions summaries updated.
Changed 2026-10-09: OIDC example (decision 053): example-oidc.md added; summaries of example, project-setup, test-strategy, questions and decisions updated; section "Project rules affected (decision 053)" added.
Changed 2026-10-09: release-round design review (decision 052 points 12-13): `exports` `default`, `require()` smoke check, Node 22 failure blocks; project-setup, release-checks, test-strategy summaries updated.
Changed 2026-10-09: Q16-Q18 answered (decision 052 points 9-11): `src` published, Dependabot for actions, Node 22 and 24 only; project-setup, release-checks, questions summaries updated.
Changed 2026-10-09: release preparation (decision 052): release-checks.md added; summaries of project-setup, test-strategy, questions and decisions updated; section "Project rules affected (decision 052)" added.
Changed 2026-10-07: questions and decisions summaries updated for Q1-Q4, then for the review revision (decisions 018-022, Q5).
Changed 2026-10-07: Q5 answered (decision 023).
Changed 2026-10-07: SQLite blob-bigint question answered (decision 026); decisions summary range updated.
Changed 2026-10-08: decisions 027-029 (task 14 follow-ups) added; summaries updated.
Changed 2026-10-08: decisions summary range updated for 030 (task 18) and 031 (task 21).
Changed 2026-10-08: questions and decisions summaries updated for the low-findings answers (decisions 033-038, Q7).
Changed 2026-10-08: post-v1 icons (decision 039): views.md summary, open questions Q8-Q10, decisions summary range.
Changed 2026-10-08: Q8-Q10 answered; questions summary updated.
Changed 2026-10-08: post-v1 restyle (decision 040): views-style.md added; open question Q11; decisions summary range.
Changed 2026-10-08: Q11 answered (option (a)); questions summary updated.
Changed 2026-10-08: follow-up triage answers L011/L010 (decision 037 point 6) and L013 (decision 041) recorded; open question Q12 added; questions and decisions summaries updated.
Changed 2026-10-08: Q12 answered (decision 037 point 7); questions summary updated.
Changed 2026-10-08: security audit fixes (decisions 042-048): summaries of admin, auth, routes, routes-handlers, data, introspect, forms, views, support, example and project-setup updated; open questions Q13-Q14 added; decisions summary range updated.
Changed 2026-10-08: Q13 (listPerPage capped at 500) and Q14 (full key-check scope kept) answered (decision 045); questions summary updated.
Changed 2026-10-09: Q15 answered (option (b), `_lang`); admin, routes and questions summaries updated.
Changed 2026-10-09: design review, i18n round: test-migration list, `binary` key (views `format.ts` takes `t`), forms/auth/decision fixes; views and support summaries updated.
Changed 2026-10-09: internationalization (decisions 049-051): summaries of admin, auth, routes, routes-handlers, forms, views, views-style, support, project-setup, test-strategy, questions and decisions updated; section "Project rules affected" added.

| File | Summary |
|---|---|
| README.md | This overview: components, layout, data flow, error handling, project rules affected by i18n, by release preparation and by the OIDC example |
| interfaces/admin.md | Public API types (§5.2 plus additions), createAdmin/register validation (incl. `sessionMaxAgeSec` cap, `siteTitle` kept `null` when unset, reserved slug `_lang`), ResolvedModel (default `listDisplay` without `exclude` keys, permission inheritance from `view`), finalization |
| interfaces/introspect.md | `introspectTable`, ModelMeta/FieldMeta, kind and flag mapping (identity columns are generated; PG `valueCheck`), PK/FK rules, snapshot projection |
| interfaces/data.md | Repository API, query builders (search/filter/order/pk parsing with DB value domains), DB error classification, Drizzle boundary |
| interfaces/forms.md | Form field layout, widget defaults, coercion rules (integers via `parseFieldValue`), zod schema, validation pipeline, widget rendering; error texts from a `t: Messages` argument |
| interfaces/auth.md | Session/flash cookies with per-instance derived keys, unsigned locale cookie `da_lang` (`readLocale`, `writeLocale`), CSRF check, safe `next`, login redirects, permission helpers (`can`, `canAny`) |
| interfaces/routes.md | App assembly: AdminVars context (incl. cookie keys, `locale`, `t`), middleware order (locale in `initVars`, guard exemption for `POST /_lang/`), security headers and CSP, hidden-model 404, route table, catch-all, error handling |
| interfaces/routes-handlers.md | Per-page handler behavior: texts from `c.var.t`, dashboard, list (search text normalization), actions (selection cap), add/change (PRG, hooks), delete, login/logout, language switch |
| interfaces/views.md | JSX page components and their props (`PageChrome` with `locale`, `t`, `currentUrl`; `<html lang>`; header language switcher; `formatValue` / `formatCell` take `t`), stable selectors for tests, cell formatting, icon set and placement (decision 039), CSS and script modules (script hash for the CSP) |
| interfaces/views-style.md | `ADMIN_CSS` after the DADS-inspired restyle (decision 040): light/dark color tokens with sources, typography, reference rules per area, button variant mapping, language switcher rules, focus ring, 767px block, attribution comment |
| interfaces/support.md | `messages.ts`: `en` / `ja` dictionaries behind `MESSAGES`, the `Messages` type rule, locale helpers and `LOCALE_NAMES`, required keys (incl. `tooManySelected`, `language`, `binary`), `time.ts` functions (time-zone math, UTC calendar dates for date-only values) |
| interfaces/project-setup.md | package.json (`exports` with `default`, `files` incl. `src`, scoped name `@sson0-er/drizzle-admin`, repository links, `engines` `>=22`, `publishConfig`, `hono` and `drizzle-orm` peers, `prepack`), tsconfig(s), biome.json, vitest config, scripts, LICENSE, CHANGELOG (0.1.0 initial-release text), README outline (incl. the "Language" section and the new install/import lines); `example:oidc` script, OIDC dev dependencies, vitest `pool: "forks"` and `globalSetup` (decision 053) |
| interfaces/release-checks.md | `scripts/smoke-pack.sh` step by step, the smoke consumer and its tsconfig, the tarball content check, the `require()` check, the Node 22 failure rule, the exact CI workflow (SHA-pinned actions, read-only permissions, mise-provided tools, Node 22 smoke job), the exact `dependabot.yml` |
| interfaces/example.md | Example schema, seed, shared `createExampleAdmin`, Host check (`host-guard.ts`), server, and run instructions for the user's browser check |
| interfaces/example-oidc.md | OIDC SSO demo: flow, run-time certificate (`cert.ts`), mock IdP config (`mock-idp.ts`), `safeReturnPath` rules, app routes and the `WeakMap` getUser bridge (`app.tsx`), sign-in allowlist (`allowlist.ts`, 403 page), mode rule and TLS refusal (`mode.ts`), environment with exact error texts and explicit library settings (`config.ts`, `server.ts`), callback failure page, launcher with `NODE_EXTRA_CA_CERTS` (`launch.ts`), README text and caveats |
| test-strategy.md | Tests per component, dialect parameterization, helpers, security audit fix cases, internationalization cases and test migration, release preparation (README package-name test, smoke test and CI scope), §10 test matrix, phase gates; OIDC example (full-flow test against the mock IdP, TLS negative control, callback failure, shell isolation, allowlist outcomes, `isAllowed` / `parseAllowlist` / `readOidcExampleConfig` tables, `safeReturnPath` table, user browser check after implementation, TLS-verification guard, `oidc-global-setup.ts`) |
| questions.md | Open: none; resolved: Q19 (user's browser check of the OIDC demo is acceptance, after implementation), Q20 (no `auth.logoutUrl` now), Q21 (sign-in allowlist in the OIDC demo), OIDC example user decisions (decision 053), Q16 (publish `src` so maps resolve), Q17 (Dependabot for actions, monthly), Q18 (Node 22 and 24 only), release-preparation user decisions (decision 052), Q15 (switch route `POST <prefix>/_lang/`, reserved slug `_lang`; option (b)), internationalization user decisions (decisions 049-051), Q13 (`register()` rejects `listPerPage` above 500), Q14 (uuid / NUL / enum key checks kept), security audit fixes (decisions 042-048), Q12 (`register()` rejects `password`-widget fields in `searchFields`, `ordering` or as the primary key; decision 037 point 7), L011/L010 (password-widget list columns not sortable, no FK link on masked cells; decision 037 point 6), L013 (DoD import-line exception; decision 041), Q11 (no DADS-style required marker in the restyle, option (a); decision 040), Q8-Q10 (post-v1 icons: no `info` flash level, read-only booleans use the icon mark, other controls confirmed; decision 039), Q7 (password-widget list cells masked), low-findings triage B items and follow-ups (decisions 033-038), pnpm provisioning, Q1-Q5, hono/csrf origin equality proven by test, SQLite blob-bigint support, task 14 follow-ups (renderPage flash, buildApp type, trailing-slash open redirect, allowlist whitespace, Q6 decoded LF/CR 404), task 22 `safeNext` raw/decoded rules |
| decisions-and-evidence.md | Decisions 001-053 and evidence ids referenced by this design |
