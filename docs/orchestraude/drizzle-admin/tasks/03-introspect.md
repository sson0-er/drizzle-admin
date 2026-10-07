---
id: 03-introspect
depends_on: [01-project-setup]
status: pending
attempts: 0
---
# Task 03: introspect

## Goal
`introspectTable(table, dialect)` converts a Drizzle SQLite or PG table into `ModelMeta` and rejects wrong-dialect, no-PK and composite-PK tables. The shared test fixture schemas exist, and snapshot tests pass for both dialects.

## Scope
### Files to touch
- src/introspect/index.ts, src/introspect/sqlite.ts, src/introspect/pg.ts
- test/fixtures/schema-sqlite.ts, test/fixtures/schema-pg.ts
- test/introspect.sqlite.test.ts, test/introspect.pg.test.ts (and the vitest snapshot files they generate under test/__snapshots__/)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/messages.ts, src/time.ts, src/index.ts and every config file

## Implementation notes
- API, `FieldMeta` / `ModelMeta` shapes, mapping rules and error messages: `interfaces/introspect.md`. `Dialect = "sqlite" | "postgres"` is exported from `src/introspect/index.ts`.
- This is the only code that reads Drizzle `Column` properties. Every `any` needs `// biome-ignore lint/suspicious/noExplicitAny: <reason>` with a non-empty reason (decision 004).
- Before coding, check the installed drizzle-orm 0.45.3 type definitions for the `Column` property names (`dataType`, `columnType`, `enumValues`, `notNull`, `hasDefault`, `primary`, `generated`, `generatedIdentity`) and for `getTableConfig` of both cores.
- `toSnapshot(meta)` replaces table objects (`meta.table`, `foreignKey.table`) with table names so snapshots are JSON-safe.
- Fixture schemas (`test-strategy.md`, "Helpers"): export `authors`, `articles`, `kv` from both files with the same property keys; `schema-pg.ts` also exports `events` (with `mood` pgEnum) and covers `text` vs `varchar`, `uuid`, `date()`, `date({mode:"date"})` and an identity column (put those not already on `events` on a PG-only table of your choice, and export it). Later tasks (08 DDL, helpers) build on these exports, so keep them stable.
- Test-only tables for the error cases (no PK, composite PK, a PG table passed with dialect `"sqlite"` and vice versa) can be defined inside the test files.

## Definition of Done
- [ ] `src/introspect/index.ts` exports `Dialect`, `FieldMeta`, `ModelMeta`, `introspectTable`, `toSnapshot`.
- [ ] Every `any` type under `src/introspect/` has a `biome-ignore lint/suspicious/noExplicitAny:` comment with a reason (`pnpm lint` enforces this).
- [ ] Tests: `test/introspect.sqlite.test.ts` snapshots `toSnapshot(introspectTable(t, "sqlite"))` for each SQLite fixture table, covering text, integer, `integer({mode:"boolean"})`, `integer({mode:"timestamp"})`, `text({mode:"json"})`, `text({enum})`, FK and `primaryKey({autoIncrement:true})`, and asserts the observed values listed in introspect.md (kind, hasDefault, isAutoIncrement, foreignKey column).
- [ ] Tests: `test/introspect.pg.test.ts` snapshots every PG fixture table and asserts: `serial` → number/notNull/hasDefault/autoIncrement; pgEnum → enum with `enumValues`; `text` → isLongText; `varchar` → not isLongText; `uuid().defaultRandom()` → string, hasDefault, not autoIncrement; `date()` → kind string + isDateOnly; `date({mode:"date"})` → kind date + isDateOnly; identity PK → isAutoIncrement; `bigint({mode:"bigint"})` → bigint.
- [ ] Tests: both test files assert the thrown messages for dialect mismatch, no primary key and composite primary key (substrings from introspect.md "Errors").
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/introspect.md
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (sections "Helpers" and row "introspect")
- Decisions: docs/orchestraude/decisions/010-fieldmeta-kind-mapping.md, docs/orchestraude/decisions/023-pg-date-string-mode-support.md, docs/orchestraude/decisions/004-biome-for-lint.md
- Evidence: 2026-10-07-drizzle-column-introspection, 2026-10-07-drizzle-column-variants, 2026-10-07-drizzle-driver-runtime-behavior

## History
