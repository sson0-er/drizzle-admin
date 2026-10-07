---
id: 20-routes-delete
depends_on: [19-routes-add-change]
status: pending
attempts: 0
---
# Task 20: routes-delete

## Goal
`GET|POST /:model/:pk/delete/` shows a confirmation page and deletes the row, calling `beforeDelete`. FK constraint failures return to the list with an error flash.

## Scope
### Files to touch
- src/routes/delete.ts
- src/views/delete.tsx
- src/routes/index.ts (register route 9 in table order)
- test/delete.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/routes/form.ts, src/routes/list.ts, src/routes/middleware.ts, src/routes/context.ts (bug fixes only, recorded in History)
- src/data/**, src/auth/**, src/forms/**
- test/helpers/**, test/fixtures/**

## Implementation notes
- Handler: `interfaces/routes-handlers.md` section "Delete". `M` or 404; `delete` permission or 403; row or 404.
- GET → `DeletePage({ modelLabel: M.label, objectLabel: M.toString(row), cancelHref: change URL })`, 200.
- POST → `beforeDelete(row, { mode: "delete", user: U, db })` (throw → error flash `hookFailed`, 303 list) → `repo.delete(M.meta, [pk])` → success flash `deleted(label)`, 303 list. DB error → `classifyDbError` → error flash `dbForeignKey` or `dbOther`, 303 list.
- `DeletePage` selectors: `form#delete-form` (POST, `_csrf` hidden input), `p.confirm-text` with `messages.confirmDelete(objectLabel)`, `button[type=submit]`, and a cancel link to `cancelHref` (`interfaces/views.md` "Pages").
- Permission checks are implemented here; the permission test matrix is in task 24 and is not required in this task.

## Definition of Done
- [ ] Tests: `test/delete.test.ts` (`describe.each(dialects)`) verifies GET delete page → 200 with `form#delete-form`, `p.confirm-text` containing the row's `toString`; unknown pk → 404.
- [ ] Tests: `test/delete.test.ts` verifies POST deletes the row (gone from the DB), 303 to the list URL, and the list page shows `messages.deleted(label)`.
- [ ] Tests: `test/delete.test.ts` verifies deleting an author referenced by an article → 303 to the list URL, the next page shows `messages.dbForeignKey` in `ul.messagelist li.error`, and the author still exists.
- [ ] Tests: `test/delete.test.ts` verifies `beforeDelete` is called once with the row and `{ mode: "delete", user, db }` (`db` identical to `AdminConfig.db`); a throwing `beforeDelete` → error flash `messages.hookFailed` and the row still exists.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Delete", "Conventions")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (row `DeletePage`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (`delete`, `classifyDbError`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Integration coverage": Delete)
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md (item 10), 015-hookctx-definition.md, 011-db-error-classification.md

## History
