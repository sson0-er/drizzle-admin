---
id: 29-vanished-rows-warnings
depends_on: [20-routes-delete, 21-routes-actions]
status: pending
attempts: 0
---
# Task 29: vanished-rows-warnings

## Goal
Rows that disappear concurrently no longer produce misleading pages. A custom action with `confirm: true` whose selected ids match no row flashes the `noSelection` warning and redirects back instead of rendering an empty confirmation list (L003). A single delete that removes 0 rows flashes the new warning `alreadyDeleted(label)` instead of `deleted(label)` (L074). Decision 036 items 3 and 4.

## Scope
### Files to touch
- src/messages.ts
- src/routes/actions.ts
- src/routes/delete.ts
- test/messages.test.ts
- test/actions.test.ts
- test/delete.test.ts
### Do not touch
- The `delete_selected` branch of `src/routes/actions.ts` (decision 033 item 3 already holds)
- The `_confirm=1` step of custom actions (`run` still receives the submitted ids)
- src/views/**, src/data/**, src/auth/**
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- `src/messages.ts`: add `alreadyDeleted: (s: string) => \`「${s}」は既に削除されています。\`` next to `deleted` / `deletedMany` (support.md). `test/messages.test.ts` lists every key ("has no keys beyond the ones listed in support.md"), so add the key there too.
- `src/routes/actions.ts` (routes-handlers.md Actions step 3): in the `custom.confirm === true && !confirmed` branch, load `rows = await repo.getMany(model.meta, ids)`. When `rows.length === 0`, return the `noSelection` warning with a 303 back, as the `delete_selected` branch does. Otherwise render the confirmation page with those rows.
- `src/routes/delete.ts` (routes-handlers.md Delete step 3): keep `n = await repo.delete(model.meta, [pk])`. `n > 0` → success `deleted(label)`; `n === 0` → `warning` flash `alreadyDeleted(label)`; both redirect 303 to the list URL. `beforeDelete` has already run at that point; keep it so.
- Delete test (test-strategy.md "Delete"): a `beforeDelete` hook that deletes the row itself through `ctx.db` (for example `kv` row `a`, which has no dependents) makes `repo.delete` remove 0 rows.
- Read the flash on the page that follows the redirect, as the existing tests do (`ul.messagelist`).
- CLAUDE.md conventions apply (exact status and flash assertions).

## Definition of Done
- [ ] `messages.alreadyDeleted("x")` returns `「x」は既に削除されています。`.
- [ ] Tests: `test/messages.test.ts` lists `alreadyDeleted` and asserts its formatted text.
- [ ] Tests: `test/actions.test.ts`, both dialects. A custom action with `confirm: true` posted without `_confirm` and with only a nonexistent id (`_selected=999999`) answers 303 to the list URL. The next page shows the `noSelection` warning. The response is not a confirmation page (no `form#action-confirm`), and `run` was not called.
- [ ] Tests: `test/delete.test.ts`, both dialects. With a `beforeDelete` hook that deletes the row through `ctx.db`, `POST .../delete/` answers 303 to the list URL. The next page shows `alreadyDeleted(label)` in a warning item and does not contain `deleted(label)`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Actions" step 3, "Delete" step 3)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md (section "`src/messages.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (Integration coverage: "Delete", "Actions")
- Decisions: docs/orchestraude/decisions/036-triage-behavior-changes.md (items 3, 4), docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 3)

## History
