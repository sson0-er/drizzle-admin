---
id: 08-db-helpers-and-repository
depends_on: [07-data-query]
status: done
attempts: 0
---
# Task 08: db-helpers-and-repository

## Goal
Tests can create fresh in-memory SQLite and PGlite databases with fixture rows and count queries. The repository (list/get/getMany/create/update/delete/options) works identically on both dialects.

## Scope
### Files to touch
- test/helpers/db.ts
- test/fixtures/ddl-sqlite.sql.ts, test/fixtures/ddl-pg.sql.ts
- src/data/repository.ts
- test/repository.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- test/fixtures/schema-sqlite.ts, test/fixtures/schema-pg.ts (owned by task 03; if a fixture column must change, stop and report blocked)
- src/data/query.ts, src/data/db.ts except bug fixes found by these tests (record any fix in History)

## Implementation notes
- `test/helpers/db.ts`: `export const dialects: DialectFixture[]` with `DialectFixture = { name: "sqlite" | "pglite"; dialect; setup(opts?: { logger? }): Promise<{ db; schema; close(); queryCount(): number }> }` (test-strategy.md "Helpers"). Each `setup` creates every table exported by the fixture schema from constant DDL and inserts deterministic fixture rows (authors, articles with FKs, kv; on PG also `events`). Query counting uses a Drizzle custom logger `{ logQuery() { n++ } }`.
- Repository API and behavior: `interfaces/data.md#srcdatarepositoryts`. `list` issues exactly 2 queries; `get`/`update` with an invalid PK return `null` without querying; `getMany`/`delete` drop invalid PKs and dedupe, and an empty list issues no query; `update` with empty `data` returns `get()`. All writes use `.returning()`.
- `createRepository({ db, dialect, timeZone, now? })`; `now` defaults to `() => new Date()` and is injectable for date filters.
- DB errors propagate unchanged (classification is task 09).

## Definition of Done
- [ ] `test/helpers/db.ts` exports `dialects` with entries named `sqlite` and `pglite`, and `setup()` returns `{ db, schema, close, queryCount }`.
- [ ] Tests: `test/repository.test.ts` runs under `describe.each(dialects)` and verifies `list` total, paging (`page`, `perPage`), ordering, and that `queryCount()` increases by exactly 2 per `list` call.
- [ ] Tests: `test/repository.test.ts` verifies search treats `%` and `_` literally (a row containing `100%` matches `q="100%"`, a row without `%` does not), and each filter kind (boolean, enum, FK, date preset on a timestamp).
- [ ] Tests: `test/repository.test.ts` (PG only, `events`) verifies search across `code` (uuid), `amount` (numeric) and `mood` (pgEnum) returns the matching rows without error; with injected `now` and `timeZone` `Asia/Tokyo`, filter `today` on `day` and on `due` returns exactly the rows of the Tokyo calendar date (rows of the previous and next day and null `due` rows are excluded).
- [ ] Tests: `test/repository.test.ts` verifies get/getMany/create/update/delete/options, including invalid PK strings (`get`/`update` → null, `getMany`/`delete` skip them) and `options` returning `{ value: String(pk), label }` in the given ordering with `limit`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md#srcdatarepositoryts
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (sections "Helpers", row "data/repository")
- Decisions: docs/orchestraude/decisions/018-pg-search-text-cast.md, 019-date-only-calendar-dates.md, 023-pg-date-string-mode-support.md
- Evidence: 2026-10-07-drizzle-driver-runtime-behavior, 2026-10-07-pg-date-string-mode-filtering, 2026-10-07-pg-search-non-text-columns

## History
