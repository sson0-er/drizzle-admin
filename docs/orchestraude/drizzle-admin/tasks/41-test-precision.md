---
id: 41-test-precision
depends_on: [33-security-test-fixes, 40-password-hardening-and-cleanup]
status: done
attempts: 0
---
# Task 41: test-precision

## Goal
Tests only. This task fixes the test A items of `06-low-findings-followup-triage.md` so that each test fails when the behavior it covers breaks:
- L008 / L019: a denied add POST is checked for a created row.
- L012: every 403-matrix case has a unique, readable title.
- L022: the flash XSS test checks that the payload is kept as text.
- L017: the `aria-hidden` check does not depend on state that earlier tests filled in.
- L020: the `DisplayValue` time-zone test uses one case per `it.each` row.
- L023: the FK-select order test no longer falls back to the whole document.
- L026: the name path of `describeForLog` gets the 64/65-character boundary.

## Scope
### Files to touch
- test/auth.test.ts (describe "403 for each missing permission")
- test/views.test.ts (describe "icons on pages")
- test/widgets.test.ts (describe "DisplayValue")
- test/form.test.ts (the "orders the FK select by the referenced model's default" case)
- test/errors.test.ts (the "writes only safe names and codes to the log line" table)

### Do not touch
- src/**, README.md, example/**, test/helpers/**, test/fixtures/**
- Every test file not listed above
- In the listed files, every test other than the ones named in "Files to touch"
- Do not delete, weaken or skip an existing assertion except where the Implementation notes say to replace it
- docs/** (except this task's History), CLAUDE.md, docs/orchestraude/review-policy.md
- biome.json, package.json, vitest.config.ts
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact assertions, no fallbacks that hide a missing element.

- **L008 / L019, test/auth.test.ts** (the `cases` table at about line 477, add POST row).
  - Today the test compares `rowsOf(id)` before and after the denied request. That only covers the pre-existing author, not a row the denied request might create.
  - Add an optional field to the case type, e.g. `creates?: (id: string) => string`, holding the name that the request would insert (`added-${id}` for the add POST row).
  - When the field is set, assert after the denied request that no author with that name exists (a select by `name`, exact `toEqual([])` or `toHaveLength(0)`).
  - After the allowed control request, assert that exactly one such author exists. This proves the name check can see the row.
  - Build the name query like `rowsOf` (raw `select().from(authors()).where(eq(getTableColumns(authors()).name …))`).
- **L012, test/auth.test.ts** (same table).
  - Add a required `label: string` field to every row, describing method and route, e.g. `"GET /admin/authors/<id>/change/"`, `"POST /admin/authors/ (delete_selected)"`.
  - Use `$label` instead of `$method $path` in the `it.each` title, e.g. `"$perm false: $label -> 403, allowed -> $ok"`. The 8 resulting titles must be pairwise different and must not contain `[Function`.
  - Keep `method`, `path`, `form` and `ok` as they are.
- **L022, test/views.test.ts** ("renders a flash text that looks like an svg as text next to the icon only").
  - Keep the icon assertion.
  - Add an exact text assertion on the same `li`: `text(li).trim()` is `"<svg onload=alert(1)>"`, as the cell XSS test in the ListPage block of the same describe does.
- **L017, test/views.test.ts** (describe "icons on pages").
  - Move the `aria-hidden` check into the describe's `render` helper: after parsing, assert that every `svg` element in the parsed tree has `aria-hidden="true"`. Each test then checks its own pages, also when run alone (`-t`) or shuffled.
  - Remove the module-level `rendered` array and the final "marks every svg rendered above as aria-hidden" test, which the helper replaces.
  - Keep the comment above the helper accurate.
- **L020, test/widgets.test.ts** ("shows a date-only Date and a json value the same in %s").
  - Replace it with one `it.each` of `{ zone, field, value, expected }` rows, four in total:
    - date-only `Date("2026-10-07T00:00:00Z")` → `2026/10/07`, for `Asia/Tokyo` and for `America/New_York`;
    - json `{ a: 1 }` → `{"a":1}`, for each of the two zones.
  - Use a title with `$zone` plus a case name, so the four titles are distinct.
- **L023, test/form.test.ts** ("orders the FK select by the referenced model's default: $name").
  - Remove the `select ?? doc` fallback.
  - Assert that the select exists (`expect(select).not.toBeNull()`), then query its options through `select as Element`, the cast pattern of the file. A missing `select` must fail the test instead of reading options from the whole page.
- **L026, test/errors.test.ts** (the sanitization `it.each`). Add two rows:
  - `"a 64-character name of the safe charset"`: `{ name: <64 chars from [A-Za-z0-9_.-]>, code: "23505" }` → `unique <that name> 23505`;
  - `"a 65-character name"`: `{ name: "A".repeat(65), code: "23505" }` → `unique - 23505`.
  - Both follow `SAFE_LOG_TOKEN` in src/data/errors.ts and test-strategy.md (data/errors row).
- Other test files and production code are out of scope. If a fixed test fails against the current code, that is a production defect: record it in History and report the task as blocked. Do not change `src/`.

## Definition of Done
- [ ] test/auth.test.ts, describe "403 for each missing permission":
  - every row has a `label`, and the `it.each` title uses `$label`. The vitest output (`pnpm test test/auth.test.ts --reporter=verbose`) shows 8 distinct titles per dialect for this table, none containing `[Function`;
  - the add POST row asserts that no `added-<id>` author exists after the denied request, and that exactly one exists after the allowed control request.
- [ ] test/views.test.ts:
  - the flash XSS case asserts `text(li).trim()` equals `<svg onload=alert(1)>` and keeps its icon assertion;
  - the `render` helper of describe "icons on pages" asserts `aria-hidden="true"` on every `svg` it parses;
  - the `rendered` array and the "marks every svg rendered above as aria-hidden" test no longer exist (`grep -n "rendered above" test/views.test.ts` finds nothing);
  - `pnpm vitest run test/views.test.ts -t "puts the logout icon"` passes and runs the aria-hidden check inside that test.
- [ ] test/widgets.test.ts: the `DisplayValue` time-zone test is an `it.each` with 4 rows of `{ zone, field, value, expected }`, one assertion per row, and the old test is gone.
- [ ] test/form.test.ts: `grep -n "?? doc" test/form.test.ts` finds nothing. The FK-select order case asserts that the `select` is not null before reading its options.
- [ ] test/errors.test.ts: the sanitization table has the two new rows (64-character safe name kept, 65-character name written `-`) with exact expected strings.
- [ ] Test diff (decision 041): in `git diff test/`, removed lines are limited to:
  - test/auth.test.ts: the case-type declaration, the rows of `cases` and the `it.each` title/body of "403 for each missing permission";
  - test/views.test.ts: the `rendered` array and the `render` helper of "icons on pages", the final aria-hidden test, and the flash XSS case body;
  - test/widgets.test.ts: the "shows a date-only Date and a json value the same in %s" test;
  - test/form.test.ts: the `select ?? doc` line;
  - in any file: edits to existing import lines that only add names.
  test/errors.test.ts only gains lines.
- [ ] `git diff --quiet src README.md example` succeeds (no production change).
- [ ] scripts/verify.sh passes

## References
- Triage: docs/orchestraude/drizzle-admin/06-low-findings-followup-triage.md (section "A. Fix recommended", "test": L008, L019, L012, L022, L017, L020, L023, L026)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (table rows "views", "forms" and "data/errors"; "Icons (decision 039)" (views.test.ts accessibility bullet); "§10 test matrix", "Permissions in routes")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (`describeForLog` sanitization)
- Decisions: docs/orchestraude/decisions/041-dod-test-diff-import-lines.md, docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 16)
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

- Attempt 1: done. Tests only (auth, views, widgets, form, errors); verify passes. No export or prop added. `Element` type added to the existing helpers/html import in test/form.test.ts (import line only adds a name). The `render` helper in "icons on pages" cannot assert a non-empty svg list (some pages have none), so the old `length > 0` check is not carried over; each icon test already asserts its icons.
- Review round 1: high 0, medium 0, low 1 (quality: needless spread around flatMap in the DisplayValue table, test/widgets.test.ts:255). Done.
