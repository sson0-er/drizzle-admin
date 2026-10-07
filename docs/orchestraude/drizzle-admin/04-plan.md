# Implementation plan: drizzle-admin

## Tasks
| # | Task | depends_on | Summary |
|---|---|---|---|
| 01 | project-setup | - | package.json, tsconfigs, Biome, vitest, LICENSE, .gitignore, `scripts/verify.sh` (test, typecheck, lint, build), `messages.ts` |
| 02 | support-time | 01 | `time.ts`: zones, datetime-local, date-only UTC dates, preset ranges |
| 03 | introspect | 01 | `introspectTable` → ModelMeta for SQLite/PG, fixture schemas, snapshot tests |
| 04 | public-types-and-create-admin | 02, 03 | Public types, ResolvedModel/AdminState, `createAdmin` validation incl. `publicOrigin`, index exports, type tests |
| 05 | register-and-finalize | 04 | `register` checks and defaults, `allowedWidgets`, finalization, `admin.app`/`fetch`, stub `buildApp` |
| 06 | example-app | 05 | `example/` schema, seed, app, server; phase-1 smoke test (end of phase 1) |
| 07 | data-query | 02, 03 | `db.ts` boundary, `escapeLike`, search, filters, ordering, PK parsing |
| 08 | db-helpers-and-repository | 07 | `test/helpers/db.ts` + DDL fixtures, repository on both dialects |
| 09 | data-errors | 08 | `classifyDbError`, `describeForLog`, `isDbError` |
| 10 | views-format-url-static | 08 | Cell formatting, `withQuery`/sort cycle, base CSS, select-all script |
| 11 | views-layout-and-list-pages | 10 | Layout, dashboard, list, error pages; flash types; parse5 helper |
| 12 | auth-session-flash-permissions | 05, 11 | Signed session and flash cookies, `isSecure`, `can`, `ACTION_PERMISSION` |
| 13 | auth-origin-check | 01 | `originCheck(publicOrigin)` with the decision-020 exact-match tests, `tokensEqual` |
| 14 | routes-app-shell | 06, 09, 12, 13 | `buildApp`: headers, static, Origin, session, user, CSRF token, dashboard, catch-all, fallback, onError; `makeAdmin` helper |
| 15 | routes-list | 14, 11 | List page with search/filters/order/paging/FK labels (no N+1), 500 logging; example phase-2 smoke (end of phase 2) |
| 16 | forms-fields | 05 | `buildFormGroups`, editability, default widgets, FK `tooMany` fallback |
| 17 | forms-coerce-validate | 16, 02 | Coercion, zod schema, validation pipeline |
| 18 | forms-widgets-and-form-page | 16, 11 | Widgets, `toFormValue`, `DisplayValue`, `FormPage` |
| 19 | routes-add-change | 15, 17, 18 | Add/change handlers, hooks, DB errors, PRG, three buttons, date-only cases (end of phase 3) |
| 20 | routes-delete | 19 | Delete page and handler, FK failure flash |
| 21 | routes-actions | 20 | Bulk delete and custom actions with/without confirmation (end of phase 4) |
| 22 | auth-redirect-and-login-page | 11 | `safeNext`, login redirect URLs, `LoginPage` |
| 23 | login-logout-and-auth-guard | 21, 22 | Login/logout routes, auth guard, remove pre-auth user, helper logs in by default, auth tests |
| 24 | security-matrix-and-proxy | 23 | Permission matrix, XSS, `proxy.test.ts`, example phase-5 smoke (end of phase 5) |
| 25 | polish-css-and-fk-fallback | 24 | Dark mode and responsive CSS, FK > 200 fallback integration test |
| 26 | readme | 25 | README per outline, `readme.test.ts` (end of phase 6) |

## Execution order
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26

Numeric order satisfies every `depends_on`. Phase boundaries (§13): phase 1 = 01-06, phase 2 = 07-15, phase 3 = 16-19, phase 4 = 20-21, phase 5 = 22-24, phase 6 = 25-26. Because every task's gate is `scripts/verify.sh` (test, typecheck, lint, build), the phase gate of the requirements holds at the end of each phase.

Parallelizable later (independent `depends_on`): 02/03/13 after 01; 07 with 04-06; 16-18 with 07-15 once 05 (and 11 for 18) is done; 22 after 11.

### Staging notes (planner choices, not design changes)
- Sessions, the Origin check, the CSRF token check, flash and `can()` are wired in phase 2 (tasks 12-14), because test-strategy.md says only the auth guard is absent before phase 5 and the test client sends Origin and tokens from the start. Login/logout and the guard come in phase 5 (task 23).
- Before phase 5 there is no login, but handlers need a non-null user for `can()` and `HookCtx`. Task 14 adds a temporary `PRE_AUTH_USER` in `src/routes/middleware.ts` for builtin mode; task 23 removes it (its DoD checks with grep) and switches `makeAdmin` to logging in by default.
- Route tasks 15, 19, 20, 21 implement permission checks; the permission test matrix is written once in task 24 (`test/auth.test.ts`).
- The FK > 200 fallback is implemented with forms (tasks 16 and 19) because forms.md defines it there; phase 6 (task 25) adds its integration test. Dark mode and the 767px layout are deferred to task 25 as §13 phase 6 lists them.

## Definition of Done shared by all tasks
- scripts/verify.sh passes
- Changes stay within the task's declared scope
- Every new or changed behavior has a test
