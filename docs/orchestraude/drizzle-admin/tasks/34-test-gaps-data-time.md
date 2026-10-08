---
id: 34-test-gaps-data-time
depends_on: [29-vanished-rows-warnings]
status: done
attempts: 0
---
# Task 34: test-gaps-data-time

## Goal
The data, time and delete paths named in the low-findings triage have tests that fail when the behavior breaks:
- date-before-FK precedence and the unknown-column error in the query builders (L054, L100);
- all date presets through `buildFilters` (L099);
- a backslash search that matches a real row (L093);
- the unchanged driver error from `create` (L097);
- the `DrizzleQueryError` branch of `isDbError` (L114);
- preset ranges on DST transition days (L101);
- the `dbOther` and non-DB rethrow branches of single and bulk delete (L102, L103);
- the vanished-rows branch of `delete_selected` (L138, decision 033 item 3).

Test-only task.

## Scope
### Files to touch
- test/query.test.ts
- test/repository.test.ts
- test/errors.test.ts
- test/time.test.ts
- test/delete.test.ts
### Do not touch
- src/** (if a new test fails against the current code, stop, report the case and the observed result in History, and leave the code unchanged)
- test/helpers/** and test/fixtures/** (create extra rows or ad-hoc metas inside the test)
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- L054 / L100 (`query.test.ts`):
  - Build an ad-hoc `ModelMeta` whose date field (kind `date`, or `isDateOnly`) also has a `foreignKey`. Spreading `foreignKey: { ... }` onto the `publishedAt` field meta of the introspected `articles` table is enough, because `buildFilters` only reads the meta. With `f = "today"` it must produce a range condition with two bound params (`>=` / `<`), not an equality.
  - Add `expect(() => buildOrderBy(meta, [{ key: "nope", desc: false }])).toThrow()` for the unknown-column error of `columnOf`.
- L099 (`query.test.ts`): an it.each over `today`, `past7`, `month`, `year` with fixed `now = 2026-10-06T16:00:00Z` and `Asia/Tokyo`. For a timestamp field, assert the two bound params of the `.toSQL()` output. The expected values are hard-coded in the table, derived by hand from support.md (`datePresetRange` / `calendarPresetRange`), not recomputed by calling those functions.
- L093 (`repository.test.ts`): insert an `articles` row whose title contains a backslash (for example `back\slash`) inside the test, then search with `q = "\\"`. Exactly that row is returned. Remove the row afterwards, or use a fresh setup, so other tests keep their counts.
- L097 (`repository.test.ts`): the create-error test asserts the driver's unique-violation signal per dialect (SQLite: message matches `/UNIQUE constraint failed/`; PGlite: the error or a `.cause` carries `code === "23505"`), not just `rejects.toThrow()`.
- L114 (`errors.test.ts`): `new DrizzleQueryError("select 1", [], new Error("no code"))` (from `drizzle-orm`) → `isDbError` is `true` and `classifyDbError` is `"other"`.
- L101 (`time.test.ts`): `datePresetRange("today", now, "America/New_York")`:
  - `now = 2026-03-08T17:00:00Z` → `[2026-03-08T05:00:00Z, 2026-03-09T04:00:00Z)` (23 h);
  - `now = 2026-11-01T17:00:00Z` → `[2026-11-01T04:00:00Z, 2026-11-02T05:00:00Z)` (25 h).
- L102 / L103 (`delete.test.ts`): you choose the mechanism. Two that work:
  - for `dbOther`, a `beforeDelete` hook that drops the table through `ctx.db` (use a dedicated `makeAdmin` instance, because the table is gone afterwards);
  - for the non-DB rethrow, a `vi.mock` of `../src/data/repository.js` that wraps `createRepository` and makes `delete` throw a plain `Error` while a test flag is set. It delegates to the real repository otherwise.
  The rethrow case answers 500 (`onError`). Cover both the single delete (`POST /:model/:pk/delete/`) and `delete_selected` with `_confirm=1`.
- L138 (`delete.test.ts`): `POST /admin/<model>/` with `action=delete_selected` and only `_selected=999999`, both without and with `_confirm=1`.
- CLAUDE.md conventions apply (it.each tables, exact status and flash assertions).

## Definition of Done
- [ ] Tests: `test/query.test.ts`. A date-kind field with a `foreignKey` and `f = "today"` yields a range with two bound params. `buildOrderBy` with an unknown key throws. The it.each over the four presets asserts hard-coded bounds.
- [ ] Tests: `test/repository.test.ts`, both dialects. `q = "\\"` returns exactly the inserted backslash row. The duplicate-create test asserts the per-dialect unique-violation signal.
- [ ] Tests: `test/errors.test.ts`. A synthetic `DrizzleQueryError` without a code → `isDbError` true and `classifyDbError` `"other"`.
- [ ] Tests: `test/time.test.ts`. The two New York DST `today` ranges equal the instants above.
- [ ] Tests: `test/delete.test.ts`, both dialects:
  - single delete and `delete_selected` + `_confirm=1` with a non-FK DB error → 303 to the list URL, and the next 200 page shows `messages.dbOther` as an error. If the table was dropped, its list cannot render, so read the flash from the dashboard `GET /admin/`;
  - the same two requests with a non-DB error → 500;
  - `delete_selected` with only `_selected=999999`, with and without `_confirm=1` → 303 to the list, the next page shows the `noSelection` warning, and the table row count is unchanged.
- [ ] No file under `src/` is changed.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (sections "`src/data/query.ts`", "`src/data/repository.ts`", "`src/data/errors.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md (section "`src/time.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "Actions" step 2, "Delete" step 3)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (Integration coverage "Bulk delete with vanished rows (L138)")
- Decisions: docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 3), docs/orchestraude/decisions/022-unmatched-routes-and-error-rendering.md
- Findings: docs/orchestraude/drizzle-admin/05-low-findings.md (L054, L093, L097, L099-L103, L114, L138 details)

## History
