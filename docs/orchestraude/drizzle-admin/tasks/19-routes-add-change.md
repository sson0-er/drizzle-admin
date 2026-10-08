---
id: 19-routes-add-change
depends_on: [15-routes-list, 17-forms-coerce-validate, 18-forms-widgets-and-form-page]
status: done
attempts: 0
---
# Task 19: routes-add-change

## Goal
`GET|POST /:model/add/` and `GET|POST /:model/:pk/change/` work end to end: FK choices, validation pipeline, hooks with `HookCtx`, DB error mapping, PRG with flash messages and the three save buttons, for every column type on both dialects. This completes phase 3.

## Scope
### Files to touch
- src/routes/form.ts
- src/routes/index.ts (register routes 6, 7, 8 in table order)
- test/form.test.ts
- test/example.test.ts (add the phase-3 part)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/forms/**, src/views/**, src/data/**, src/auth/**, src/routes/middleware.ts, src/routes/context.ts (bug fixes only, recorded in History)
- test/helpers/**, test/fixtures/**

## Implementation notes
- Handler steps: `interfaces/routes-handlers.md` sections "Add", "Change" and "Conventions".
- FK choices (add and change, GET and POST): for each form FK field with `foreignKey.slug`, `opts = repo.options(refMeta, { limit: 201, ordering: ref.ordering, toLabel: ref.toString })`; `opts.length > 200 ? "tooMany" : opts`.
- Change: GET needs `view`, POST needs `change` (403 otherwise); `canChange = can(M, "change", U)`; save buttons only if `canChange`; delete link only if `can(M, "delete", U)`; a missing row → 404; `repo.update` returning `null` → 404.
- `beforeSave` throw → form error `hookFailed`, 400; DB error → form error by `classifyDbError` (`dbUnique`, `dbForeignKey`, `dbNotNull`, `dbOther`), 400; `afterSave` throw → extra warning flash `afterSaveFailed` after a successful write.
- Redirects (303): add → `_addanother` add URL, `_continue` change URL of the new row, else list URL; change → `_continue` same change URL, `_addanother` add URL, else list URL. Flash `added(...)` / `changed(...)` with `M.toString(row)`.
- `HookCtx` = `{ mode, user: U, db: state.config.db }` (decision 015). Until task 23, `U` is the temporary pre-auth user from task 14.
- Permission checks are implemented here; the permission test matrix is in task 24 and is not required in this task.

## Definition of Done
- [ ] Tests: `test/form.test.ts` (`describe.each(dialects)`) verifies add and change GET → 200 for `authors`, `articles` and `kv`; unknown model or pk → 404.
- [ ] Tests: `test/form.test.ts` verifies, for every column type of the fixtures (text, long text, integer, real, bigint, boolean, enum, timestamp, json, FK, text PK of `kv`), the happy path: 303, flash text on the next page, and the DB row holds the coerced value.
- [ ] Tests: `test/form.test.ts` verifies each coercion error yields 400 with the raw values kept and `div.form-row[data-field=<key>] ul.errorlist`; required error; unique violation on `authors.name` → 400, `p.errornote` present and the page text contains `messages.dbUnique`; `validate` field and form errors; mass-assignment (`id` and an unknown key in the body are ignored); readonly and auto PK not writable on add and change.
- [ ] Tests: `test/form.test.ts` verifies `beforeSave` receives and can modify `data` and is called with `{ mode: "add" | "change", user, db }` where `db` is identical (`toBe`) to `AdminConfig.db`; `afterSave` receives the saved row; a throwing `beforeSave` → 400 with `messages.hookFailed`; a throwing `afterSave` → 303 with both the success and `afterSaveFailed` flash.
- [ ] Tests: `test/form.test.ts` verifies the three buttons' `Location`: add `_save` → list, `_addanother` → add, `_continue` → new row's change page; change `_continue` → same change page, `_addanother` → add page, `_save` → list.
- [ ] Tests: `test/form.test.ts` (PG only, `events`) for `timeZone` `Asia/Tokyo` and `America/New_York`: add with `day=2026-10-07` → `select day::text` returns `2026-10-07`, the change page input value is `2026-10-07`, change POST keeps the day; the add page renders `input[type=date][name=due]`; add with `due=2026-10-07` → 303 and `select due::text` returns `2026-10-07`; the change page `due` input is `type=date` with value `2026-10-07`; change POST keeps it; `due=2026/10/07` → 400 with `messages.invalidDate` on the field and the raw value kept.
- [ ] Tests: `test/example.test.ts` additionally verifies each example model's add page (`/admin/users/add/`, `/admin/posts/add/`, `/admin/tags/add/`) returns 200.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Add", "Change", "Conventions")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (route table, `renderPage`, `redirectWithFlash`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (`create`, `update`, `options`, `classifyDbError`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Integration coverage": Add/change, Date-only, Date-only strings; row "example")
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md (items 1, 2, 10), 015-hookctx-definition.md, 019-date-only-calendar-dates.md, 023-pg-date-string-mode-support.md

## History
