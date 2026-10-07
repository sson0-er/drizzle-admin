---
id: 09-data-errors
depends_on: [08-db-helpers-and-repository]
status: done
attempts: 0
---
# Task 09: data-errors

## Goal
DB errors from both drivers are classified as unique / foreignKey / notNull / other by code, can be described for logs without SQL or parameters, and can be recognized as DB errors.

## Scope
### Files to touch
- src/data/errors.ts
- test/errors.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/data/repository.ts, src/data/query.ts, src/data/db.ts
- test/helpers/**, test/fixtures/**

## Implementation notes
- API and code table: `interfaces/data.md#srcdataerrorsts`. Walk `err` and up to 5 `.cause` levels reading a string `code`.
- `describeForLog(err)` returns only `"<kind> <name> <code>"`; never the message, SQL or parameters.
- `isDbError(err)`: `instanceof DrizzleQueryError` (import from `drizzle-orm`) or a string `code` at any of the 6 levels. Do not use `err.name`.
- Produce real errors with `test/helpers/db.ts` fixtures (duplicate unique `authors.name`, `articles.authorId` pointing at a missing author, null in a notNull column) via the repository from task 08.

## Definition of Done
- [ ] Tests: `test/errors.test.ts` runs under `describe.each(dialects)` and verifies that real unique, FK and not-null violations are classified as `unique`, `foreignKey`, `notNull`, and that `new Error("x")` is `other`.
- [ ] Tests: `test/errors.test.ts` verifies `isDbError` is true for each real driver error and false for `new Error("x")`, and that `describeForLog` of a real error raised with a bound value `secretvalue` does not contain `secretvalue`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md#srcdataerrorsts
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "data/errors")
- Decisions: docs/orchestraude/decisions/011-db-error-classification.md, 022-unmatched-routes-and-error-rendering.md
- Evidence: 2026-10-07-drizzle-driver-runtime-behavior, 2026-10-07-pg-search-non-text-columns

## History
