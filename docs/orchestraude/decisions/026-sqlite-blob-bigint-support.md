# 026: SQLite bigint columns are blob({ mode: "bigint" }), supported as kind bigint with non-numeric ordering

- Date: 2026-10-07
- Status: accepted (user decision)

## Context
`test-strategy.md` asks for an `articles.big` bigint column in both fixture schemas. drizzle's SQLite `integer()` has no bigint mode, so the only SQLite bigint column is `blob({ mode: "bigint" })`, and task 03-introspect used it for the fixture (`test/fixtures/schema-sqlite.ts`). Drizzle stores these values as the decimal digits in a BLOB. SQLite therefore compares them bytewise: ordering and range comparisons are not numeric, but equality works (evidence: 2026-10-07-sqlite-blob-bigint-ordering). The 03-introspect review asked whether to keep this, because later tasks (fixture DDL, sorting and filtering, repository tests) build on it.

## Decision
Keep supporting SQLite `blob({ mode: "bigint" })` as kind `bigint`, the same as PG `bigint({ mode: "bigint" })`. No special-casing in introspect, data, forms or views. Document as a known limitation that on SQLite, ordering and range comparison on such columns are not numeric (SQLite compares them as BLOBs). Later tasks' SQLite tests must not assume numeric ordering or range filtering on blob-bigint columns. The fixture stays `blob("big", { mode: "bigint" })`, and the SQLite DDL declares `big BLOB`. No code changes.

## Alternatives considered
- Map SQLite blob-bigint to kind `unknown` (unsupported): rejected by the user. The column would lose its form input and bigint coercion.
- Use `integer({ mode: "number" })` for the SQLite fixture column: rejected. It is not a bigint column, so the SQLite side would not exercise kind `bigint` at all (evidence: 2026-10-07-sqlite-blob-bigint-ordering).
- Make sorting numeric (e.g. `cast(cast(col as text) as integer)` in `ORDER BY`): not chosen. It adds a dialect- and column-type-specific branch that the requirements do not ask for, and it would lose precision beyond 64-bit (unverified).
- Use `customType` for an INTEGER-backed bigint: not chosen. That is a user-defined column with dataType `custom`, which maps to kind `unknown` (decision 010), so the library cannot support it generically.

## Rationale
Equality, which FK filters, `getMany` (`inArray`) and PK lookups rely on, works on blob-bigint (evidence: 2026-10-07-sqlite-blob-bigint-ordering). Only ordering and range comparison are affected. The design has no numeric range filters (`listFilter` allows boolean/enum/date/date-only/FK only, admin.md step 5), so the visible effect is the order of list sorting on such a column. The user accepted this as a documented limitation.

## Consequences
- project-setup.md README outline, "Known limitations": the SQLite blob-bigint ordering/range note.
- data.md: `buildOrderBy` and `buildFilters` notes; test-strategy.md: fixture definition, and a rule that SQLite tests must not assume numeric ordering or range filtering on `articles.big`.
- introspect.md: observed value `blob({mode:"bigint"})` → bigint on SQLite.
- Users who need numeric ordering on SQLite must model the column as `integer()` (number, safe-integer range) instead.
