---
id: 44-permission-inheritance-and-hidden-models
depends_on: [43-instance-bound-cookie-keys]
status: pending
attempts: 0
---
# Task 44: permission-inheritance-and-hidden-models

## Goal
Security audit fixes, part 2 (permissions and list defaults):
- Unset `add` / `change` / `delete` permissions take the resolved `view` function, so `permissions: { view: ... }` alone closes the model. Explicit entries are used as given, and `{}` still allows everything (decision 043 point 1).
- A registered model on which the user has none of the four permissions answers every model route with the same 404 as an unknown slug, before any other check (decision 043 point 2). Models with at least one granted permission keep the per-route 403.
- Without `listDisplay`, the default list columns skip the `exclude` keys (decision 046 point 1).

Source findings: docs/orchestraude/drizzle-admin/security-audit/verify.md (finding A), docs/orchestraude/drizzle-admin/security-audit/authz.findings.json, docs/orchestraude/drizzle-admin/security-audit/views.findings.json (default `listDisplay`).

## Scope
### Files to touch
- src/admin.ts (only the `listDisplay` default and the `permissions` object in the `ResolvedModel` built by `register`)
- src/auth/permissions.ts (add `canAny`)
- src/routes/context.ts (only `modelOr404`)
- test/register.test.ts, test/permissions.test.ts, test/auth.test.ts, test/list.test.ts, test/form.test.ts

### Do not touch
- The handlers src/routes/list.ts, form.ts, delete.ts, actions.ts, dashboard.ts: each already calls `modelOr404` first, so the 404 comes from `modelOr404` alone. If a handler turns out to run a check before `modelOr404`, report it in History instead of editing the handler.
- `can` and `ACTION_PERMISSION` in src/auth/permissions.ts stay unchanged (auth.md `permissions.ts`)
- Everything else in src/admin.ts (`createAdmin`, register validation steps, finalization); src/types.ts
- Every other file under src/**, example/**, test/helpers/**, test/fixtures/**, every other test file
- README.md, CHANGELOG.md, CLAUDE.md (task 48), package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Existing assertions may change only as listed under "Existing tests to update" below. Do not delete, weaken or skip any other assertion.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact status and message assertions.

- **Permissions** (admin.md "`ResolvedModel`" block and the "Permissions (decision 043)" paragraph below it): resolve `view` with `toPermission(options.permissions?.view)` first. For `add`, `change`, `delete`: when the entry is `undefined`, reuse that resolved `view` function; otherwise `toPermission(entry)`.
- **Default `listDisplay`** (admin.md, the "Default `listDisplay` (decision 046)" paragraph): when `options.listDisplay` is unset, take `[meta.pk.key, ...non-PK keys in definition order]`, drop every key in `options.exclude`, keep the first 5 (`1 + DEFAULT_LIST_DISPLAY_EXTRA`); an empty result becomes `[meta.pk.key]`. An explicit `listDisplay` is not filtered. `listDisplayLinks` still defaults to the first `listDisplay` entry. The existing `excluded` set can be reused; move its declaration above `listDisplay` if needed.
- **`canAny(model, user)`** (auth.md `permissions.ts`): `true` if `can()` is true for at least one of `view`, `add`, `change`, `delete`.
- **`modelOr404`** (routes.md API block and "Hidden models (decision 043)"): return the existing 404 `errorPage(c, 404, messages.notFound)` when the slug is unknown or `!canAny(model, requireUser(c))`. Both cases must give an identical response.
- **New tests** (test-strategy.md "Security audit fixes": the `register.test.ts` defaults bullet and the "Hidden models" bullet; §10 matrix row "Permissions in routes"):
  - test/register.test.ts, describe "register: defaults" (or a new describe next to it), SQLite `articles` (columns `id, title, body, authorId, publishedAt, meta, views, score, big`), one it.each row per case:
    - `exclude: ["title"]` → `listDisplay` `["id", "body", "authorId", "publishedAt", "meta"]`
    - `exclude: ["id"]` → `["title", "body", "authorId", "publishedAt", "meta"]`, and `listDisplayLinks` `["title"]`
    - every column excluded → `["id"]`
    - `listDisplay: ["id", "title"]` with `exclude: ["title"]` → `["id", "title"]`
  - test/register.test.ts permissions (it.each, users `{ id: "1" }` and `{ id: "2" }`): `{}` → all four true; `{ view: false }` → all four false; `{ view: false, add: true }` → `add` true, `change` and `delete` false; `{ view: (u) => u.id === "1" }` → for each user, `add` / `change` / `delete` equal `view`; `{ view: false, delete: true }` → `delete` true.
  - test/permissions.test.ts, new describe "canAny" (it.each): `{}` → true; `{ view: false }` → false; `{ view: false, add: true }` → true; `{ view: (u) => u.id === "1" }` → `alice` true, `bob` false.
  - test/auth.test.ts, new describe "hidden models (decision 043)" in the permission describe that has `clientWith` (both dialects). With `clientWith({ view: false })`, each of these answers 404 and its parsed body text equals that of `GET /admin/nosuch/` from the same client (one it.each row each): GET `/admin/authors/`, GET `/admin/authors/add/`, GET `/admin/authors/<id>/change/`, GET `/admin/authors/<id>/delete/`, POST `/admin/authors/<id>/change/` (valid author form), POST `/admin/authors/<id>/delete/`, POST `/admin/authors/` with no `_selected`, with `action=nope` and one `_selected`, and with `action=delete_selected`, one `_selected` and `_confirm=1`. The author row still exists after the POST rows. The dashboard `GET /admin/` (200) has no `a` whose `href` starts with `/admin/authors/`. With `clientWith({ view: false, add: true })`: GET `/admin/authors/` → 403, GET `/admin/authors/add/` → 200.
- **Existing tests to update** (test-strategy.md: "Existing permission tests that expected 403 for `view: false` with other entries unset now expect 404"):
  - test/auth.test.ts "403 for each missing permission": the two `perm: "view"` rows now expect 404 for the denied request. Add a per-row `denied` status (403 for the other rows, 404 for the two view rows) and use it in the title instead of the fixed "-> 403". The control request and the row-unchanged checks stay.
  - test/list.test.ts "answers 403 without the view permission" (`articles: { permissions: { view: false } }`): expect 404 and `messages.notFound`; retitle accordingly.
  - test/form.test.ts "forbids the change page without view permission" (`authors: { permissions: { view: false } }`): expect 404; retitle accordingly.
  - test/register.test.ts "normalizes permissions: boolean, function and undefined": `permissions?.delete(user)` is now `false` (unset `delete` inherits `view: false`); retitle so it mentions inheritance.
  - Any other existing assertion that fails only because a model with `view: false` and no other explicit permission now answers 404 instead of 403 may be switched to 404 in the same way. List each such change in History. No other existing assertion changes.
- Write the hidden-model tests and the `exclude` default rows first and run them against the unchanged code; they must fail there (403 instead of 404; excluded keys still listed). Record the received values in History.
- No export or prop beyond the design is expected (`canAny` is in auth.md). If one is added, record it in History.

## Definition of Done
- [ ] src/auth/permissions.ts exports `canAny(model: ResolvedModel, user: AdminUser): boolean`; `can` is byte-identical to before.
- [ ] `modelOr404` returns the 404 page for an unknown slug and for a model where `canAny` is false; nothing else in src/routes/context.ts changes.
- [ ] Tests (test/register.test.ts): the four default-`listDisplay` rows and the five permission-inheritance rows pass with the exact arrays and booleans listed in Implementation notes.
- [ ] Tests (test/permissions.test.ts): the `canAny` rows pass.
- [ ] Tests (test/auth.test.ts, both dialects): the nine hidden-model requests each give 404 with the same body text as `GET /admin/nosuch/`; the dashboard lists no `authors` link; `{ view: false, add: true }` gives list 403 and add page 200; the 403 matrix passes with 404 for the two view rows and 403 for the rest.
- [ ] Tests: test/list.test.ts and test/form.test.ts `view: false` cases expect 404.
- [ ] History records that the new hidden-model and `exclude`-default tests failed against the pre-change code, and lists every existing assertion changed under the "Existing tests to update" rule.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (`ResolvedModel`, "Default `listDisplay`" and "Permissions" paragraphs)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md#`permissions.ts`
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (API block `modelOr404`; "Hidden models (decision 043)"; "Error handling")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (the "Changed 2026-10-08" note at the top about `modelOr404`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md ("Security audit fixes (decisions 042-048)"; §10 row "Permissions in routes")
- Decisions: docs/orchestraude/decisions/043-permission-inheritance-and-hidden-models.md, docs/orchestraude/decisions/046-column-exposure-defaults.md (point 1)
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
