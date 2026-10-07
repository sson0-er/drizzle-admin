---
id: 21-routes-actions
depends_on: [20-routes-delete]
status: pending
attempts: 0
---
# Task 21: routes-actions

## Goal
`POST /:model/` runs bulk actions: the built-in `delete_selected` with a confirmation page, and custom actions with and without confirmation, with flash results and PRG back to the same list state. This completes phase 4.

## Scope
### Files to touch
- src/routes/actions.ts
- src/views/confirm-action.tsx
- src/routes/index.ts (register route 5 `POST /:model/` in table order)
- test/actions.test.ts
- test/delete.test.ts (add the bulk-delete cases)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/routes/list.ts, src/routes/delete.ts, src/routes/form.ts, src/routes/middleware.ts, src/routes/context.ts (bug fixes only, recorded in History)
- src/data/**, src/auth/**, src/forms/**
- test/helpers/**, test/fixtures/**

## Implementation notes
- Handler: `interfaces/routes-handlers.md` section "Actions". Body: `action`, `_selected` (string or array), optional `_confirm=1`. `back` = list URL + the request's query string. Selected ids are deduped strings; none → warning flash `noSelection`, 303 back.
- `delete_selected`: needs `delete` (403). Without `_confirm` → `ConfirmActionPage({ isDelete: true, items })`, 200. With `_confirm=1` → `getMany`, `beforeDelete` per row with `mode: "delete"` (throw → error flash `hookFailed`, 303 back), `repo.delete` → flash `deletedMany(n)`, 303 back; DB error → `dbForeignKey` / `dbOther` flash, 303 back.
- Custom action: unknown name → error flash `unknownAction`, 303 back; needs `ACTION_PERMISSION` (`change`, 403); `confirm && !_confirm` → `ConfirmActionPage({ isDelete: false, actionLabel })`, 200; else `await a.run({ ids, db, user: U })` → flash `result?.message ?? actionDone`; throw → error flash `actionFailed`; 303 back.
- `ConfirmActionPage` selectors: `form#action-confirm` POST to list URL + `backQuery`, hidden `action`, `_confirm=1`, one hidden `_selected` per item, `ul.objects li` per item, `_csrf` hidden input (`interfaces/views.md` "Pages"). Texts: `messages.confirmAction(label)`, `messages.confirmYes`, `messages.cancel`.
- Permission checks are implemented here; the permission test matrix is in task 24 and is not required in this task.

## Definition of Done
- [ ] Tests: `test/actions.test.ts` (`describe.each(dialects)`) verifies: no selection → 303 back with `messages.noSelection` warning; unknown action → `messages.unknownAction` error flash; a custom action without `confirm` runs once with the selected ids (deduped strings), `db` and `user`, and its returned message is flashed; a custom action returning nothing flashes `messages.actionDone`; a throwing action flashes `messages.actionFailed`.
- [ ] Tests: `test/actions.test.ts` verifies a custom action with `confirm: true`: first POST → 200 `form#action-confirm` with one hidden `_selected` per id and `ul.objects li`, and `run` not called; POST with `_confirm=1` → `run` called and 303.
- [ ] Tests: `test/actions.test.ts` verifies the 303 `Location` is the list URL plus the original query string (e.g. `/admin/authors/?q=a&o=-id`).
- [ ] Tests: `test/delete.test.ts` adds bulk delete: `delete_selected` without `_confirm` → 200 confirmation listing each row's `toString`; with `_confirm=1` → rows removed and `messages.deletedMany(n)` flashed; `beforeDelete` called once per row with `mode: "delete"`; FK failure → `messages.dbForeignKey` error flash and rows kept.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Actions", "Conventions")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (row `ConfirmActionPage`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (`ACTION_PERMISSION`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Integration coverage": Delete, Actions)
- Decisions: docs/orchestraude/decisions/016-custom-action-permission.md, 015-hookctx-definition.md, 013-unspecified-page-behaviors.md (item 10)

## History
