---
id: 07-data-query
depends_on: [02-support-time, 03-introspect]
status: done
attempts: 0
---
# Task 07: data-query

## Goal
Pure query builders exist: LIKE escaping, dialect-aware search (PG `::text` + `ilike`, SQLite `like ... escape '\'`), filters (boolean / enum / FK / date presets for timestamps, date-only Dates and date-only strings), ordering with the PK appended, and PK / field value parsing. The Drizzle `db` boundary cast exists.

## Scope
### Files to touch
- src/data/db.ts
- src/data/query.ts
- test/query.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/introspect/**, src/time.ts, src/admin.ts, src/types.ts

## Implementation notes
- API and rules: `interfaces/data.md` sections "src/data/db.ts" and "src/data/query.ts". `sql.raw` is never used; user input is always a bound parameter.
- Columns come from `meta.table[key]` (decision 009).
- `buildFilters`: the date branch (kind date, or `isDateOnly` of either kind) is checked before the FK branch. Bounds: PgDate date-only → `calendarPresetRange` Dates; PgDateString → `toDateOnly(start)` / `toDateOnly(end)` strings; timestamps → `datePresetRange`. Invalid values are ignored.
- `buildOrderBy`: append `asc(pk)` when the PK is not already in the list.
- `asQueryDb(db: unknown)` is the single cast with a reasoned `biome-ignore lint/suspicious/noExplicitAny:`.
- Use the fixture schemas from task 03 in tests. SQL is inspected with `.toSQL()` on a query built from a real drizzle instance per dialect (an in-memory better-sqlite3 db and a PGlite db are fine; no rows are needed).

## Definition of Done
- [ ] `grep -rn "sql.raw" src/` finds nothing.
- [ ] Tests: `test/query.test.ts` verifies `escapeLike` for `\`, `%`, `_` and mixed input.
- [ ] Tests: `test/query.test.ts` verifies `buildSearch` SQL via `.toSQL()`: PG produces `"<col>"::text ilike $n` for every search column (including a uuid/numeric/pgEnum column of `events`), SQLite produces `like ? escape '\'`, the pattern is a parameter `%<escaped>%`, and empty `q` / empty `searchFields` → `undefined`.
- [ ] Tests: `test/query.test.ts` verifies date filters: on a kind-date `isDateOnly` field the params are UTC-midnight ISO strings; on `events.due` (date-only string) with `today`, `now = 2026-10-06T16:00Z`, `Asia/Tokyo` the params are `"2026-10-07"` and `"2026-10-08"`; on a timestamp field the params are the time-zone instants from `datePresetRange`.
- [ ] Tests: `test/query.test.ts` verifies boolean (`1`, `0`), enum, and FK filters, and that invalid values (`f=2`, unknown enum, non-numeric FK, unknown preset) add no condition.
- [ ] Tests: `test/query.test.ts` verifies `buildOrderBy` appends the PK ascending only when absent, and `parsePk` / `parseFieldValue` cases: integer `"12"` → 12, `"1.5"`/`"x"`/unsafe integer → null for integer fields, bigint `"9007199254740993"` → `9007199254740993n`, string raw, unknown kind → null.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (sections "src/data/db.ts", "src/data/query.ts")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md#srctimets (preset functions, `toDateOnly`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "data/query")
- Decisions: docs/orchestraude/decisions/009-search-filter-sql.md, 018-pg-search-text-cast.md, 019-date-only-calendar-dates.md, 023-pg-date-string-mode-support.md
- Evidence: 2026-10-07-pg-search-non-text-columns, 2026-10-07-pg-date-string-mode-filtering, 2026-10-07-drizzle-driver-runtime-behavior

## History
