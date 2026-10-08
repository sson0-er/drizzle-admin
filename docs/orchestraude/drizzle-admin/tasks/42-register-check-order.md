---
id: 42-register-check-order
depends_on: [40-password-hardening-and-cleanup, 41-test-precision]
status: done
attempts: 0
---
# Task 42: register-check-order

## Goal
This task fixes the remaining low findings of tasks 40 and 41 (`tasks/40-password-hardening-and-cleanup.findings.md`, `tasks/41-test-precision.findings.md`, "## low"):
- [spec] `register()` runs the three `password`-widget checks (primary key, `searchFields`, `ordering`) only after every widget has passed the `allowedWidgets` check, as admin.md step 5 says. A config with both errors throws the not-allowed-widget error first.
- [quality] The three password checks all use braces.
- [quality] The `DisplayValue` time-zone `it.each` table in test/widgets.test.ts lists its four rows literally, without the spread and `flatMap` cross product.

Out of scope: the finding "Leading union carries a rule tag" (src/views/format.ts:53). The reviewer called it acceptable as is.

## Scope
### Files to touch
- src/admin.ts (only the `for (const [key, widget] of widgetEntries)` loop at about lines 201-215 in `register`)
- test/register.test.ts (describe "register: password widget restrictions": add one test)
- test/widgets.test.ts (describe "DisplayValue": the "shows a $name the same in $zone" `it.each` table)

### Do not touch
- Every other file under src/**, including src/views/format.ts (the "Leading union" finding is out of scope)
- In src/admin.ts: anything outside the widget loop named above; no error message text changes
- In test/register.test.ts and test/widgets.test.ts: every test other than the ones named in "Files to touch"
- Every other test file, test/helpers/**, test/fixtures/**
- README.md, example/**, CLAUDE.md, biome.json, package.json, vitest.config.ts
- docs/** (except this task's History), docs/orchestraude/review-policy.md
- Do not delete, weaken or skip an existing assertion.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact message assertions.

- **src/admin.ts, check order** (admin.md "`admin.register(table, options = {})`" step 5):
  - Split the current loop in two.
  - Loop 1 keeps `const field = column("widgets", key)` and the `allowedWidgets(field).includes(widget)` check with its existing `fail(...)`, and nothing else.
  - Loop 2 comes directly after loop 1 and is another `for (const [key, widget] of widgetEntries)`. It skips entries whose widget is not `"password"`, then runs the three existing checks in this order: `key === meta.pk.key`, `searchFields.some(...)`, `ordering.some(...)`. Loop 2 does not need `column(...)`: step 4 has already checked every widget key.
  - All three checks in loop 2 use `{ ... }` braces, with the `fail(...)` call on its own line. Keep the error message strings exactly as they are; the existing tests pin them.
- **test/register.test.ts, ordering test** (describe "register: password widget restrictions"):
  - Add one `it` after the existing `it.each`. The test registers `kv` (fixture `test/fixtures/schema-sqlite.ts`: `key` text PK, `value` text) with `{ widgets: { key: "password", value: "checkbox" } }`.
  - `key` is listed first, so the current single loop throws the PK error first. `checkbox` is not in `allowedWidgets` for a non-FK `string` field (src/forms/fields.ts).
  - Assert with `registerError(kv, …)` and exact `toBe`: `drizzle-admin: kv: widget "checkbox" is not allowed for field "value" (kind string)`.
  - Suggested title: "checks every widget against allowedWidgets before the password restrictions".
  - Write this test first and run it against the unchanged src/admin.ts. It must fail there, with the PK message as the received value. Record that in History.
- **test/widgets.test.ts, DisplayValue table** (about lines 253-268):
  - Replace `it.each([...["Asia/Tokyo", "America/New_York"].flatMap((zone) => [ ... ])])` with an `it.each([...])` whose array literal holds four object rows, written out:
    - `{ zone: "Asia/Tokyo", name: "date-only Date", field: dateOnly, value: new Date("2026-10-07T00:00:00Z"), expected: "2026/10/07" }`
    - `{ zone: "America/New_York", name: "date-only Date", field: dateOnly, value: new Date("2026-10-07T00:00:00Z"), expected: "2026/10/07" }`
    - `{ zone: "Asia/Tokyo", name: "json value", field: json, value: { a: 1 }, expected: '{"a":1}' }`
    - `{ zone: "America/New_York", name: "json value", field: json, value: { a: 1 }, expected: '{"a":1}' }`
  - Keep the `dateOnly` and `json` constants, the title "shows a $name the same in $zone" and the test body unchanged. Format with Biome (`pnpm lint` must pass).
- No export or prop is added. If one is needed, record it in History.

## Definition of Done
- [ ] src/admin.ts `register`: the loop that calls `allowedWidgets` contains no reference to `"password"`. A second `for (const [key, widget] of widgetEntries)` loop directly after it holds the three password checks in the order PK, `searchFields`, `ordering`. Each check is an `if (...) {` block. `grep -n '"password"' src/admin.ts` shows the occurrence only inside the second loop.
- [ ] The four error message templates in that region (not-allowed widget, primary key, searchFields, ordering) are byte-identical to before. The existing `it.each` "rejects the widget on $name" and describe "register: widget overrides" pass unchanged.
- [ ] Tests: test/register.test.ts, describe "register: password widget restrictions", has a new test. Registering `kv` with `{ widgets: { key: "password", value: "checkbox" } }` gives exactly `drizzle-admin: kv: widget "checkbox" is not allowed for field "value" (kind string)`. History records that this test failed against the pre-change src/admin.ts.
- [ ] Tests: in test/widgets.test.ts, the DisplayValue time-zone `it.each` gets an array literal of exactly four object rows (the four listed in Implementation notes). `grep -n "flatMap" test/widgets.test.ts` finds nothing. `pnpm vitest run test/widgets.test.ts -t "the same in" --reporter=verbose` shows four distinct passing titles.
- [ ] Test diff (decision 041): in `git diff test/`, test/register.test.ts only gains lines (apart from import-line edits that only add names). In test/widgets.test.ts, the removed lines are limited to the old `it.each([ ... ])` argument of the "shows a $name the same in $zone" test.
- [ ] `git diff --name-only` lists only src/admin.ts, test/register.test.ts, test/widgets.test.ts, and this task file.
- [ ] scripts/verify.sh passes

## References
- Findings: docs/orchestraude/drizzle-admin/tasks/40-password-hardening-and-cleanup.findings.md ("## low": "Password checks run inside the allowedWidgets loop, not after it", "Inconsistent braces in the new password checks"); docs/orchestraude/drizzle-admin/tasks/41-test-precision.findings.md ("## low": "Needless spread around flatMap in the DisplayValue table")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md#admin.register(table, options = {}) (step 5, including the "Then, for every `widgets[key] === "password"`" paragraph)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (`allowedWidgets`)
- Decisions: docs/orchestraude/decisions/037-password-widget-no-echo.md (point 7), docs/orchestraude/decisions/041-dod-test-diff-import-lines.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
- Attempt 1: done. Split the `register` widget loop in src/admin.ts into an allowedWidgets loop and a password-checks loop (PK, searchFields, ordering; all with braces). Added the ordering test in test/register.test.ts; run first against the unchanged src/admin.ts it failed (Received: `drizzle-admin: kv: the primary key "key" cannot use the password widget`), and passes after the change. Replaced the DisplayValue time-zone `it.each` cross product with four literal rows. No export or prop added. scripts/verify.sh passes.
- Review round 1: high 0, medium 0, low 0. Done.
