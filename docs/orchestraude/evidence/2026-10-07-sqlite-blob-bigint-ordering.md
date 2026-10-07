---
id: 2026-10-07-sqlite-blob-bigint-ordering
question: How does drizzle 0.45.3 store SQLite blob({mode:"bigint"}) values, and do SQLite ordering, range and equality comparisons on them behave numerically?
source: node_modules drizzle-orm 0.45.3 (sqlite-core/columns/blob.js, integer.d.ts); scratch script with better-sqlite3 13.0.3 on node v24.21.0
fetched: 2026-10-07
expires: 2027-01-05
---
Learned:
- drizzle's SQLite `integer()` modes are only `number`, `boolean`, `timestamp`, `timestamp_ms`; there is no bigint mode. `blob({ mode: "bigint" })` (columnType `SQLiteBigInt`, dataType `bigint`) is the only bigint column.
- `SQLiteBigInt.mapToDriverValue` writes `Buffer.from(value.toString())`, i.e. the decimal digits as UTF-8 bytes in a BLOB; `mapFromDriverValue` parses them back with `BigInt(...)`.
- With values 9, 10, -5, 100 stored that way, `order by b` returns -5, 10, 100, 9 (bytewise, not numeric). `b > blob'5'` returns only 9. `b > 5` (numeric param) returns every row, because SQLite orders any BLOB after any number.
- Equality works: `b = blob'10'` matches exactly one row, so `eq` / `inArray` with drizzle-mapped bigint values find the right rows.
Not confirmed:
- Behaviour of drizzle-generated `gt`/`lt` SQL on this column was inferred from the mapping (values are bound as Buffers), not run through drizzle itself.
