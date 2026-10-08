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
| 17a | test-pglite-stability | 08, 17 | Follow-up (user-approved): make `scripts/verify.sh` deterministic under parallel PGlite startup via `vitest.config.ts` timeouts/concurrency (or PGlite reuse in `test/helpers/db.ts`); 5 consecutive passing runs |
| 18 | forms-widgets-and-form-page | 16, 11 | Widgets, `toFormValue`, `DisplayValue`, `FormPage` |
| 19 | routes-add-change | 15, 17, 18 | Add/change handlers, hooks, DB errors, PRG, three buttons, date-only cases (end of phase 3) |
| 20 | routes-delete | 19 | Delete page and handler, FK failure flash |
| 21 | routes-actions | 20 | Bulk delete and custom actions with/without confirmation (end of phase 4) |
| 22 | auth-redirect-and-login-page | 11 | `safeNext`, login redirect URLs, `LoginPage` |
| 23 | login-logout-and-auth-guard | 21, 22 | Login/logout routes, auth guard, remove pre-auth user, helper logs in by default, auth tests |
| 24 | security-matrix-and-proxy | 23 | Permission matrix, XSS, `proxy.test.ts`, example phase-5 smoke (end of phase 5) |
| 25 | polish-css-and-fk-fallback | 24 | Dark mode and responsive CSS, FK > 200 fallback integration test |
| 26 | readme | 25 | README per outline, `readme.test.ts` (end of phase 6) |
| 27 | fk-ordering-and-example | 06, 15, 19 | Follow-up: FK filter/select choices use the referenced model's default ordering (pk desc fallback, L083); seed clamp computed inside `seed()` + seed-distribution test (L002, L090, L119); example binds `127.0.0.1` with `HOST` (decision 038) |
| 28 | fk-reference-view-permission | 27 | Follow-up: `"noView"` FK choices, list labels/links/filter gated by `view` on the referenced model (decision 034, L047, L048); `tooMany` link only for default/`select` (L062); FK filter comment fix (L060) |
| 29 | vanished-rows-warnings | 20, 21 | Follow-up: custom confirm action with no surviving rows → `noSelection` (L003); 0-row single delete → `alreadyDeleted` warning (L074); new messages key |
| 30 | cookie-deletion-and-head-guard | 12, 23, 24 | Follow-up: session/flash deletion cookies carry the same attributes incl. `Secure` (L072); logged-out HEAD gets `next` like GET (L064) |
| 31 | password-keep-on-empty | 28 | Follow-up: change-mode empty `password` submission omitted from `data`, zod `.optional()`, `required` false (decision 037 points 2-3) |
| 32 | password-no-echo | 31, 28 | Follow-up: password input renders empty, display-only field and list cell show `********` (decision 037 points 1, 4, 5) |
| 33 | security-test-fixes | 28, 30 | Follow-up, tests only: delete-refusal test and 403 controls on dedicated rows, attribute XSS payload, full trailing-slash allowlist and 301 cases, per-dialect pages cases (L044, L089, L096, L053, L086, L092, L091) |
| 34 | test-gaps-data-time | 29 | Follow-up, tests only: query/repository/errors/time/delete gaps (L054, L100, L099, L093, L097, L114, L101, L102, L103) + vanished `delete_selected` pin (L138) |
| 35 | test-gaps-forms-views-auth | 30, 32 | Follow-up, tests only: fields/coerce/widgets/flash/views/types/config/introspect gaps (L121, L128, L136, L137, L106, L108, L111, L116, L118, L117, L034, L129) + JSON truncation pin (L135) |
| 36 | readme-and-hardening | 27, 28, 32, 34 | Follow-up: README accuracy (L049, L050, L087, L051, L082, L045; body-size limit and `127.0.0.1`/`HOST`, decision 038; password and FK view notes); `describeForLog` name/code sanitization (L046); `safeNext` comment (L004, L080); `run` JSDoc (L045) |
| 37 | claude-md | 27-36 | Follow-up: expand CLAUDE.md (overview, commands, layout, design and security principles, where docs live, agent workflow), Conventions section kept verbatim |

## Execution order
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 17a → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26

Numeric order satisfies every `depends_on`. Task 17a is an inserted follow-up and runs between 17 and 18 (its id sorts there lexically: `17-…` < `17a-…` < `18-…`); existing tasks keep their numbers. Phase boundaries (§13): phase 1 = 01-06, phase 2 = 07-15, phase 3 = 16-19 (including 17a), phase 4 = 20-21, phase 5 = 22-24, phase 6 = 25-26. Because every task's gate is `scripts/verify.sh` (test, typecheck, lint, build), the phase gate of the requirements holds at the end of each phase.

Parallelizable later (independent `depends_on`): 02/03/13 after 01; 07 with 04-06; 16-18 with 07-15 once 05 (and 11 for 18) is done; 22 after 11.

### Staging notes (planner choices, not design changes)
- Sessions, the Origin check, the CSRF token check, flash and `can()` are wired in phase 2 (tasks 12-14), because test-strategy.md says only the auth guard is absent before phase 5 and the test client sends Origin and tokens from the start. Login/logout and the guard come in phase 5 (task 23).
- Before phase 5 there is no login, but handlers need a non-null user for `can()` and `HookCtx`. Task 14 adds a temporary `PRE_AUTH_USER` in `src/routes/middleware.ts` for builtin mode; task 23 removes it (its DoD checks with grep) and switches `makeAdmin` to logging in by default.
- Route tasks 15, 19, 20, 21 implement permission checks; the permission test matrix is written once in task 24 (`test/auth.test.ts`).
- Task 17a (follow-up, user-approved) fixes PGlite startup timeouts under parallel vitest files, observed in task 15 attempt 1 and in 3 of 4 full runs during task 17. It touches only `vitest.config.ts` and, if needed, `test/helpers/db.ts`; `src/` and test assertions are out of scope. It depends on 17 only so its 5-run gate covers the full suite as of that point; no later task depends on it in content, but it runs before 18 so later gates are not flaky.
- The FK > 200 fallback is implemented with forms (tasks 16 and 19) because forms.md defines it there; phase 6 (task 25) adds its integration test. Dark mode and the 767px layout are deferred to task 25 as §13 phase 6 lists them.

### Follow-up tasks 27-37 (low-findings triage and approved design changes)
Execution order: 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37

Numeric order satisfies every `depends_on`; tasks 01-26 are done and unchanged. The sources are `05-low-findings-triage.md` (A items and follow-up candidates 1-7) and decisions 033, 034, 036, 037 and 038. L067 (labels) is out of scope: decision 035 keeps raw keys.
- Behavior changes come first (27-32), so the test-only tasks (33-35) and the README (36) are written against the final code. CLAUDE.md (37) runs last so that it describes the final code.
- Dependencies between follow-up tasks come from shared files:
  - 27 → 28: `src/routes/list.ts` and `form.ts`, same functions;
  - 28 → 31: `src/forms/fields.ts`;
  - 28 / 31 → 32: `src/routes/list.ts` and `test/password-widget.test.ts`;
  - 29 → 34: `test/delete.test.ts`;
  - 28 / 30 → 33: `test/auth.test.ts`;
  - 30 / 32 → 35: `test/flash.test.ts`, `test/format.test.ts`, `test/widgets.test.ts`, `test/views.test.ts`;
  - 34 → 36: `test/errors.test.ts`.
  Task 36 also depends on 27, 28 and 32 because the README describes their behavior.
- 31 (empty password keeps the stored value) runs before 32 (input renders empty). In the other order there would be an intermediate state where saving the change form without retyping wipes the password.
- Parallelizable later: 29 and 30 are independent of 27/28 and of each other; 33, 34 and 35 are independent of each other once their dependencies are done.
- Every follow-up task's DoD includes `scripts/verify.sh`. Implementers follow the Conventions section in `CLAUDE.md`. Reviewers do not re-raise items in `docs/orchestraude/review-policy.md`.
- Design text not yet updated, which the tasks follow anyway (orchestrator to sync):
  - routes-handlers.md List step 5 writes `ordering: refModel.ordering`, while task 27 applies decision 013 item 7 (pk descending fallback);
  - data.md does not yet state the `describeForLog` charset rule of task 36 (L046).

## Definition of Done shared by all tasks
- scripts/verify.sh passes
- Changes stay within the task's declared scope
- Every new or changed behavior has a test
