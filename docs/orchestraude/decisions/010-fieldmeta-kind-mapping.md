# 010: FieldMeta additions and kind mapping rules

- Date: 2026-10-07
- Status: accepted

## Context
§6 says kind is derived from `dataType` and `columnType`, with `enumValues` meaning enum. Downstream code must never touch Drizzle `Column`, yet §9 needs integer-ness (coercion), long-text-ness (PG `text` → textarea) and auto-increment detection.

## Decision
- `FieldMeta` gains internal fields: `isInteger`, `isLongText`, `isDateOnly`, `isGenerated`. ModelMeta is internal (not exported), so this is not a public API change.
- kind: `string` + non-empty `enumValues` → `enum`; dataType `string|number|bigint|boolean|date|json` → same kind; anything else (`buffer`, `array`, `custom`, ...) → `unknown`.
- `isInteger`: kind number and columnType in {SQLiteInteger, PgInteger, PgSmallInt, PgBigInt53, PgSerial, PgSmallSerial, PgBigSerial53}.
- `isLongText`: columnType `PgText` and kind `string`.
- `isDateOnly`: columnType `PgDate` (kind date) → default widget `date` instead of `datetime`.
  Changed 2026-10-07: also columnType `PgDateString` (kind string stays), see decision 023.
- `isGenerated`: `column.generated` defined (computed columns) → always display-only.
- `isAutoIncrement`: primary key and (SQLite columnType `SQLiteInteger`, i.e. rowid alias, with or without `autoIncrement`; or PG columnType in {PgSerial, PgSmallSerial, PgBigSerial53, PgBigSerial64}; or `generatedIdentity` defined).
- Primary key: the set of columns with `primary === true` plus columns in `getTableConfig(t).primaryKeys[*].columns`. Size 0 → "no primary key" error; size > 1 → composite key error.
- `foreignKey`: only single-column FKs; `column` is the referenced column's property key. `slug` is set at finalization only when the referenced table is registered AND the referenced column is that model's primary key.

## Alternatives considered
- Expose `columnType` in FieldMeta and let forms decide: leaks Drizzle internals out of `src/introspect/`.
- Map PG `date()` (PgDateString) to kind `date`: values are strings, not Date objects, so kind `date` coercion would write the wrong type. It stays kind `string`. (It gets `isDateOnly` since decision 023.)

## Rationale
Column type names and flags were confirmed at runtime on 0.45.3 (evidence: 2026-10-07-drizzle-column-introspection, 2026-10-07-drizzle-column-variants, 2026-10-07-drizzle-driver-runtime-behavior). PgBigSerial64 was not probed (unverified). Composite-key members do not have `primary` set (evidence: 2026-10-07-drizzle-column-introspection).

## Consequences
- The snapshot tests include the added fields.
