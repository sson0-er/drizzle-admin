---
id: 46-search-and-selection-caps
depends_on: [44-permission-inheritance-and-hidden-models, 45-key-value-domains-and-identity]
status: done
attempts: 0
---
# Task 46: search-and-selection-caps

## Goal
Security audit fixes, part 4 (request size bounds, decision 045 points 2, 3 and 5):
- The list search text `q` has every U+0000 removed, is trimmed and cut to its first 200 code points. That value is searched and echoed in the search box, so `?q=a%00b` no longer gives a PG 500 and an oversized `q` is truncated.
- A bulk action with more than 500 distinct selected ids answers the warning flash `messages.tooManySelected(500)` and 303 back to the list, with no DB query and no `run`. `MAX_SELECTED = 500` is exported from src/routes/actions.ts and is the only definition of the number.
- `register()` rejects `listPerPage` above `MAX_SELECTED`, so "select all" on a full page always fits the cap.

Source findings: docs/orchestraude/drizzle-admin/security-audit/data.findings.json, docs/orchestraude/drizzle-admin/security-audit/dynamic.md (item 6b).

## Scope
### Files to touch
- src/routes/list.ts (only the `q` parsing in step 2 of the list handler)
- src/routes/actions.ts (`export const MAX_SELECTED = 500` and the cap check)
- src/messages.ts (add `tooManySelected`)
- src/admin.ts (only the `listPerPage` check in `register`, plus the `MAX_SELECTED` import)
- test/list.test.ts, test/actions.test.ts, test/register.test.ts, test/messages.test.ts

### Do not touch
- src/data/** (`buildSearch` does not repeat the normalization, data.md), src/forms/**, src/introspect/**, src/auth/**
- Every other part of src/routes/list.ts, src/routes/actions.ts and src/admin.ts
- src/views/** (the search box already echoes the `q` prop)
- test/helpers/**, test/fixtures/**, every other test file
- README.md, CHANGELOG.md, CLAUDE.md (task 48), package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Do not delete, weaken or skip an existing assertion. The only allowed edit to existing assertions: `listPerPage` error cases in test/register.test.ts switch to the new message.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact status and flash assertions.

- **Search text** (routes-handlers.md List step 2, the `q` bullet): `q = Array.from(raw.replaceAll("\u0000", "").trim()).slice(0, 200).join("")` with `raw = params.get("q") ?? ""`, still only when `M.searchFields.length > 0`. The 200 is a module-private `SEARCH_MAX_LENGTH = 200`. Pass the normalized value to `repo.list` and to `ListPage` as `q`.
- **Selection cap** (routes-handlers.md Actions step 1): directly after the existing `ids.length === 0` → `noSelection` check, `ids.length > MAX_SELECTED` → `flashBack("warning", messages.tooManySelected(MAX_SELECTED))`. `ids` is already deduplicated by `selectedIds`. This runs after `modelOr404` and before the action lookup, the permission checks, any `repo` call and any `run`.
- **messages** (support.md `src/messages.ts`): `tooManySelected: (max: number) => \`一度に操作できるのは ${max} 件までです。\``, placed after `unknownAction`.
- **`listPerPage`** (admin.md `register` step 5): `import { MAX_SELECTED } from "./routes/actions.js"`; `listPerPage` must be an integer with `0 < v <= MAX_SELECTED`; every failure throws `` `${name}: listPerPage must be a positive integer of at most ${MAX_SELECTED}` `` (with the existing `drizzle-admin: ` prefix from `fail`). Keep the check at its current position in `register`.
- **Tests** (test-strategy.md "Security audit fixes": the `register.test.ts` `listPerPage` sentence, the `list.test.ts` part of "Input bounds" and "Selection cap"):
  - test/list.test.ts, both dialects, `authors` with `searchFields: ["name"]` (it.each): `?q=a%00b` → 200 and the `form#changelist-search` `input[name=q]` value is `ab`; `?q=` followed by 250 `x` → 200 and the value is exactly 200 `x`.
  - test/actions.test.ts, both dialects:
    - 501 distinct `_selected` values (`"1"` to `"501"`) with `action=delete_selected` and `_confirm=1` → 303 to the list URL; the next GET of the list shows exactly one flash, level `warning`, text `messages.tooManySelected(500)`; the `authors` row count is unchanged.
    - A custom action registered with a `run` spy, posted with 501 distinct ids → 303 with the same warning, and the spy was not called.
    - 500 distinct values (`"1"` to `"500"`, which include existing fixture ids) plus duplicates of some of them, with `action=delete_selected` and no `_confirm` → 200 confirmation page.
  - test/register.test.ts (it.each): `listPerPage: 500` accepted (resolved `500`); `501`, `0` and `1.5` each throw exactly `drizzle-admin: <table>: listPerPage must be a positive integer of at most 500`. Existing `listPerPage` error cases now expect this message.
  - test/messages.test.ts: `tooManySelected` is in the required-key list, and `messages.tooManySelected(500)` equals `一度に操作できるのは 500 件までです。`.
- Write the new tests first and run them against the unchanged code. They must fail there (search box keeps the NUL or 250 characters; 501 ids reach the confirmation / delete path; `501` is accepted). Record the received values in History.
- `MAX_SELECTED` is exported per routes-handlers.md; no other export is expected. If one is added, record it in History.

## Definition of Done
- [ ] src/routes/actions.ts has `export const MAX_SELECTED = 500`; `grep -nw "500" src/routes/actions.ts src/admin.ts` shows that literal only in that declaration (comments excepted).
- [ ] In `actionsHandler` the `MAX_SELECTED` check comes directly after the `noSelection` check and before the first `can(`, `repo.` or `.run(` call.
- [ ] src/routes/list.ts has a module-private `SEARCH_MAX_LENGTH = 200`, and the `q` passed to `repo.list` and `ListPage` is the normalized value.
- [ ] Tests (test/list.test.ts): the two `q` rows pass on both dialects.
- [ ] Tests (test/actions.test.ts): the 501-id `delete_selected`, the 501-id custom action (spy not called) and the 500-id confirmation cases pass on both dialects.
- [ ] Tests (test/register.test.ts, test/messages.test.ts): the `listPerPage` rows and the `tooManySelected` key and text pass.
- [ ] History records that the new tests failed against the pre-change code, with the received values.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (List step 2 `q`; Actions step 1)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md#`admin.register(table, options = {})` (step 5, `listPerPage`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md#`src/messages.ts`
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (`buildSearch` note; `getMany` / `delete` bind-parameter note)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md ("Security audit fixes (decisions 042-048)")
- Design: docs/orchestraude/drizzle-admin/03-design/questions.md (resolved Q13)
- Decisions: docs/orchestraude/decisions/045-request-input-bounds.md (points 2, 3, 5)
- Evidence: docs/orchestraude/evidence/2026-10-08-bind-parameter-limits.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

### Attempt 1: done
- New tests were written first and run against the unchanged code; all failed as expected:
  - list `?q=a%00b`: sqlite echoed `a�b` (expected `ab`); pglite answered 500 (expected 200).
  - list `?q=` + 250 `x`: both dialects echoed the 250-character value (expected 200).
  - actions, 501 ids with `delete_selected` + `_confirm=1`, and 501 ids with the custom `tag` action: both dialects received no flash (`[]`, expected the `tooManySelected(500)` warning), i.e. the request reached the delete / `run` path. `messages.tooManySelected` did not exist yet (`not a function`); the received values above were taken after adding only that message.
  - register `listPerPage` `0`, `1.5`, `-1`: received `drizzle-admin: authors: listPerPage must be a positive integer` (old message); `501` was accepted (register did not throw).
  - messages: `tooManySelected` was `undefined`.
  - The 500-ids-plus-duplicates confirmation case passes on the old code too (it pins that the cap counts distinct ids).
- No export beyond `MAX_SELECTED` was added.
- `scripts/verify.sh` passes.
- Review round 1: high 0, medium 0, low 3 (tests: trim/code-point cut not pinned, searched value not asserted; spec: flash count filtered by class). Done.
