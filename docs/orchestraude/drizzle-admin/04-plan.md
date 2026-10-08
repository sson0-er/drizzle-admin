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
| 38 | ui-icons | 28, 32, 35 | Post-v1 enhancement (decision 039, user-approved): fixed inline SVG icon set `src/views/icons.tsx` (`aria-hidden`, `currentColor`), icons on listed buttons/links/flash items, `BooleanMark` for boolean list cells (`cellBoolean`, `Cell.bool`) and `DisplayValue` booleans, icon CSS without `url(` |
| 39 | dads-restyle | 38 | Post-v1 enhancement (decision 040): `ADMIN_CSS` rewritten per views-style.md (28 tokens in both schemes, typography, button variants by existing selectors, card flash, black/yellow focus ring), attribution as a TS comment only; new `test/admin-css.test.ts`; no markup, selector, messages or test-hook change |
| 40 | password-hardening-and-cleanup | 36, 38 | Follow-up (decision 037 points 6-7): `password`-widget list columns not sortable (`sortHref: null`, `?o=` drops the key) and no FK link on masked cells (L011, L010); `register()` rejects `password` on the PK / in `searchFields` / in `ordering` (Q12); README external-mode wording (L014) and password notes; shared rule 0-3 precedence helper for `formatCell` / `cellBoolean` (L001); `Icon` guard kept with a why-comment (L007) |
| 41 | test-precision | 33, 40 | Follow-up, tests only: denied add POST creates no row (L008/L019), unique 403-matrix titles (L012), flash XSS text kept (L022), aria-hidden check per render (L017), one case per `DisplayValue` row (L020), no `?? doc` fallback (L023), 64/65-char name in `describeForLog` (L026) |
| 42 | register-check-order | 40, 41 | Follow-up (task 40/41 review lows): `register()` password-widget checks moved to a second loop after the `allowedWidgets` loop (admin.md step 5 order), braces on all three, order-pinning test in `test/register.test.ts`; `DisplayValue` time-zone `it.each` rows written out literally in `test/widgets.test.ts` |
| 43 | instance-bound-cookie-keys | 42 | Security audit (decisions 042, 047): `deriveCookieKey`, `CookieOpts.key` / `FlashOpts.key`, lazily derived keys in `AdminVars.cookieKeys`, `cookieOpts(c)` / `flashOpts(c)`; `sessionMaxAgeSec` ≤ 34560000; external-mode `next` through `safeNext`; cross-instance, replica and external-`next` tests |
| 44 | permission-inheritance-and-hidden-models | 43 | Security audit (decisions 043, 046 point 1): unset `add` / `change` / `delete` inherit `view`; `canAny`; `modelOr404` answers 404 for a model with no permission; default `listDisplay` skips `exclude`; existing `view: false` 403 tests become 404 |
| 45 | key-value-domains-and-identity | 44 | Security audit (decisions 045 points 1, 4, 6; 046 point 2): `FieldMeta.valueCheck`, identity columns `isGenerated`, `parseFieldValue` PG int/uuid/NUL/enum domains, integer form coercion via `parseFieldValue`; PG snapshot update |
| 46 | search-and-selection-caps | 44, 45 | Security audit (decision 045 points 2, 3, 5): `q` NUL strip + 200 code points, `MAX_SELECTED = 500` cap with `tooManySelected` warning, `register()` rejects `listPerPage` > 500 |
| 47 | csp-and-nosniff | 43 | Security audit (decision 044): `SELECT_ALL_SCRIPT_SHA256` + hash pin test, `securityHeaders(csp)` with `buildCsp(authMode)` (no `form-action` in external mode), `nosniff` on every response |
| 48 | example-host-guard-and-docs | 43, 44, 45, 46, 47 | Security audit (decision 048 + docs of 042-047): `example/host-guard.ts` and server wiring, `prepack`, `CHANGELOG.md`, README updates, CLAUDE.md "Security rules" (derived cookie keys, CSP hash rule) |

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

### Post-v1 task 38 (decision 039, UI icons)
Execution order: 37 → 38

- Tasks 01-37 are done and unchanged. Task 38 implements decision 039 with the Q8-Q10 answers: views.md "Icons", forms.md `DisplayValue`, routes-handlers.md List step 4b, the support.md messages note, and test-strategy.md "Icons (decision 039)".
- It is kept as one task, as requested, although it touches 11 source and 6 test files. The changes are small and share one new module, and the selector and regression checks only mean something over the whole set.
- Dependencies come from shared files:
  - 28: `src/routes/list.ts`;
  - 32: `src/views/format.ts`, `src/forms/widgets.tsx`, `src/routes/list.ts`;
  - 35: `test/widgets.test.ts`, `test/format.test.ts`, `test/views.test.ts`.
  It runs after 37 only because of numeric order. CLAUDE.md is not changed by it.
- Planner choice: the flash-icon and view-only boolean integration cases go in `test/form.test.ts`. test-strategy.md lists them under its "Integration (`list.test.ts` …)" bullet, but names `form.test.ts` as an option for the view-only case. `form.test.ts` already has the add-then-flash flow and the view-only `authors` setup.
- Lint gate: the evidence that Biome's `noSvgWithoutTitle` exempts `aria-hidden="true"` SVGs is not confirmed on 2.5.15. If `pnpm lint` rejects the icon `<svg>`, the task is reported blocked. Biome configuration is not relaxed.

### Post-v1 task 39 (decision 040, DADS-inspired restyle)
Execution order: 38 → 39

- Tasks 01-38 are done and unchanged. Task 39 implements decision 040 from views-style.md (normative for tokens, rules and order), views.md "Static modules" (exports, CSS requirements, verbatim decision 039 icon rules) and test-strategy.md "Restyle (decision 040)".
- Scope is `src/static/admin-css.ts` (the `ADMIN_CSS` string and the comment above it) and the new `test/admin-css.test.ts`. Every existing test file stays unchanged; the existing CSS cases in `test/views.test.ts` are the regression gate.
- Dependency: 38 added the icon rules and `--icon-success` / `--icon-warning` to `src/static/admin-css.ts`, which this task keeps verbatim / re-values.
- If a test-strategy.md check fails against the design values (e.g. a contrast pair), the task is reported blocked; token values, pair lists and thresholds are not changed by the implementer.
- Open, non-blocking: Q11 (required-field marker) is not part of this task; if the user picks option (b), it becomes a separate task (it needs `src/messages.ts` and `FormPage` changes).
- Manual browser check (test-strategy.md "Manual") stays 未確認 until the user does it.

### Follow-up tasks 40-41 (follow-up low-findings triage, decisions 037 points 6-7 and 041)
Execution order: 39 → 40 → 41

- Tasks 01-39 are done and unchanged. The source is `06-low-findings-followup-triage.md`: its A items, and its B items as answered in decision 037 point 6 (L011, L010) and decision 041 (L013). Q12 is answered in decision 037 point 7. The triage's follow-up candidates 1-3 are batched into task 40 and candidates 4-5 into task 41, as requested.
- Task 40 touches 10 files (6 source/docs and 4 test files, adding cases only), above the usual 1-5. The orchestrator asked for this batching, and each change is small.
- Dependencies come from shared files:
  - 36 → 40: `README.md` (external-mode and password notes);
  - 38 → 40: `src/views/format.ts` (`cellBoolean`), `src/views/icons.tsx`, `src/views/list.tsx`, `src/routes/list.ts`, `test/views.test.ts`, `test/format.test.ts`;
  - 40 → 41: `test/views.test.ts` (40 adds a `ListPage` case, 41 restructures the "icons on pages" describe);
  - 33 → 41: `test/auth.test.ts` (the 403 matrix).
  Behavior change first (40), then the test-only task (41), as in the 27-36 round.
- Planner decisions:
  - **L007**: keep the `Object.hasOwn` guard in `Icon` and rewrite only its comment. CLAUDE.md says not to keep guards that the types already rule out, but views.md "Icons" requires `null` for a non-own key, and test/icons.test.ts pins `"nope"` and the inherited `"toString"`. Removing the guard would depart from the design, which needs a decision record first (CLAUDE.md "Workflow for agents"). The guard is therefore treated as a real cast boundary.
  - **L001**: the shared helper must not call the user formatter from `cellBoolean`. A naive "compute the rule-0-3 text" helper would run the formatter twice per cell. Task 40 pins this with a spy test. The exported signatures and the route call site stay unchanged.
  - **L014**: the `getUser` row of the README configuration table has the same "every request" inaccuracy as line 232, so task 40 fixes both.
  - **L010**: no test, because test-strategy.md states that the masked-cell FK-link rule has no reachable integration case (`register()` rejects `password` on FK columns). The shared rule "every new or changed behavior has a test" is waived for this one condition by the design. The DoD checks it in the code instead.
- Decision 041 applies to both DoDs' test-diff rules: editing an existing import line only to add names is allowed.

### Follow-up task 42 (task 40/41 review low findings)
Execution order: 41 → 42

- Tasks 01-41 are done and unchanged. The source is the "## low" sections of `tasks/40-password-hardening-and-cleanup.findings.md` (spec: password checks inside the `allowedWidgets` loop; quality: braces) and `tasks/41-test-precision.findings.md` (quality: spread + `flatMap` in the `DisplayValue` table).
- Out of scope: "Leading union carries a rule tag" (src/views/format.ts:53). The reviewer called it acceptable.
- Scope is src/admin.ts plus test/register.test.ts and test/widgets.test.ts. No design change: the fix makes the code follow admin.md step 5 as written. Only configs with two errors behave differently: the not-allowed-widget error now comes before a password-restriction error.
- Dependencies come from shared files:
  - 40 → 42: the `register` widget loop in `src/admin.ts`;
  - 41 → 42: the `DisplayValue` table in `test/widgets.test.ts`.
- Decision 041 applies to the test-diff rule.

### Security audit fix tasks 43-48 (decisions 042-048, Q13, Q14)
Execution order: 42 → 43 → 44 → 45 → 46 → 47 → 48

- Tasks 01-42 are done and unchanged. Sources: decisions 042-048, the design changes they list (admin, auth, routes, routes-handlers, data, introspect, forms, views, support, example, project-setup), test-strategy.md "Security audit fixes (decisions 042-048)", questions.md Q13 (`listPerPage` ≤ 500) and Q14 (uuid / NUL / enum checks kept), and the original findings in `security-audit/`.
- Six tasks instead of the suggested four: the "input bounds" group touches 7 source and 11 test files, so it is split by layer into 45 (introspect / data / forms: value domains, identity, integer coercion) and 46 (routes / admin: search text, selection cap, `listPerPage`). The "headers & surroundings" group is split into 47 (library CSP, tested by `headers.test.ts`) and 48 (example, packaging and docs), so README and CHANGELOG are written last, against the final behavior.
- Task 43 is still large (7 source and 4 test files), because the derived key changes every cookie call site at once (`session.ts`, `flash.ts`, `context.ts`, `middleware.ts`, `index.ts`, `login.ts`). The `sessionMaxAgeSec` cap and the external `next` fix are one-line changes in files it already touches (`src/admin.ts` aside).
- The default `listDisplay` fix (decision 046 point 1) goes into task 44 rather than the input-bounds tasks. It edits the same `ResolvedModel` block of `src/admin.ts` as the permission inheritance, and test-strategy.md groups both under the `register.test.ts` defaults bullet. The identity-column fix (046 point 2) goes into 45 with introspection.
- Dependencies come from shared files:
  - 42 → 43: `src/admin.ts`;
  - 43 → 44: `src/routes/context.ts` (`cookieOpts` / `flashOpts` vs `modelOr404`), `src/admin.ts`, `test/auth.test.ts`;
  - 44 → 45: `test/list.test.ts`, `test/form.test.ts` (44 turns `view: false` 403 assertions into 404, 45 adds cases);
  - 44 / 45 → 46: `src/admin.ts` and `test/register.test.ts` (44), `test/list.test.ts` (44, 45);
  - 43 → 47: `src/routes/middleware.ts`, `src/routes/index.ts`;
  - 43-47 → 48: README.md and CHANGELOG.md describe all of them; CLAUDE.md names `deriveCookieKey` (43) and `SELECT_ALL_SCRIPT_SHA256` / `buildCsp` (47).
- Parallelizable later: 47 only needs 43, so it can run alongside 44-46.
- Every task's DoD requires its new tests to fail on the pre-change code (recorded in History) and `scripts/verify.sh`.
- Planner decisions:
  - **`buildCsp` export (task 47)**: routes.md calls `buildCsp(authMode)` module-private in `middleware.ts`, but also says the policy is built once in `buildApp` (`index.ts`) and passed to `securityHeaders(csp)`. Task 47 exports `buildCsp` and records the export in History, so routes.md can be synced.
  - **Hidden-model tests (task 44)** go in `test/auth.test.ts`, next to the 403 matrix and its `clientWith` helper (test-strategy.md allows "`pages.test.ts` or a permissions test"). The matrix's two `view` rows now expect 404, as test-strategy.md requires.
  - **Changelog pointer (task 48)**: project-setup.md adds a "Changelog" pointer "after section 11", but `test/readme.test.ts` pins the exact list of `##` headings. The pointer goes inside "Development" (a sentence or a `###` subsection) instead of a new `##` heading.
  - **CLAUDE.md (task 48)**: the "Security rules" edit was requested by the orchestrator for this round. Only that section changes. If the permission system refuses the edit, the rest of task 48 still completes and the item is reported blocked.
  - **Planner-added tests**: `canAny` unit rows (44), a `fields.test.ts` case for a non-PK identity column (45), and a `hostGuard` middleware case (48). test-strategy.md does not list them, but each covers a behavior that the shared DoD requires to be tested.
- Design text not yet updated, which the tasks follow anyway (orchestrator to sync): routes.md describes `buildCsp` as module-private (task 47 exports it); project-setup.md places the Changelog pointer "after section 11" (task 48 places it inside section 11).
- Manual checks reported as 未確認 until run: the CSP console check of task 47 and the Host-header `curl` check of task 48.

## Definition of Done shared by all tasks
- scripts/verify.sh passes
- Changes stay within the task's declared scope
- Every new or changed behavior has a test
- Changed 2026-10-08 (decision 041, L013): where a task DoD limits the removed lines in `git diff test/` to a listed set, editing an existing import line only to add new names is an allowed exception (removing or renaming names, or changing the module, is not). Task 38's import-line edits are accepted under this rule.
