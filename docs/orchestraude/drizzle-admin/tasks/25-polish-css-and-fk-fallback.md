---
id: 25-polish-css-and-fk-fallback
depends_on: [24-security-matrix-and-proxy]
status: pending
attempts: 0
---
# Task 25: polish-css-and-fk-fallback

## Goal
The stylesheet supports dark mode and narrow screens (filters above the table, horizontally scrolling table below 768px). The FK select falls back to a PK input with a link to the referenced list when there are more than 200 choices, verified end to end.

## Scope
### Files to touch
- src/static/admin-css.ts
- test/views.test.ts (add CSS cases)
- test/form.test.ts (add the FK fallback cases)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/routes/**, src/forms/**, src/views/*.tsx (bug fixes only, recorded in History)
- test/helpers/**, test/fixtures/**

## Implementation notes
- CSS requirements: `interfaces/views.md` "Static modules" (§11): palette custom properties on `:root` overridden inside `@media (prefers-color-scheme: dark)`; `@media (max-width: 767px)` moves `#changelist-filter` above the table (not floated to the right) and keeps `.results { overflow-x: auto }`. Still no external URLs or `@import`. `ADMIN_CSS_VERSION` changes automatically with the content.
- The FK fallback logic already exists (task 16 `buildFormGroups` with `"tooMany"`, task 19 `options(limit: 201)`). This task adds integration coverage and fixes only what the tests reveal.
- For the fallback test, insert 201 authors into the fixture DB before requesting the article add page.

## Definition of Done
- [ ] Tests: `test/views.test.ts` asserts `ADMIN_CSS` contains `@media (prefers-color-scheme: dark)` with at least one `--` custom property redefined inside it, contains `@media (max-width: 767px)` with a `#changelist-filter` rule inside it, contains `overflow-x: auto`, and still contains no `url(http` and no `@import`.
- [ ] Tests: `test/form.test.ts` (`describe.each(dialects)`) verifies that with 200 authors the article add page renders `select[name=authorId]`, and with 201 authors it renders `input[type=number][name=authorId]`, an `a` with `href="/admin/authors/"` and the text `messages.openRelated`, and that submitting a valid author id through that input → 303 and the row is created.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (section "Static modules")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md#fieldsts (FK `tooMany` row)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (section "Add" step 2)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "views")
- Decisions: docs/orchestraude/decisions/007-static-assets.md

## History
