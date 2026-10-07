---
id: 2026-10-07-pg-search-non-text-columns
question: Does PG ilike work on non-text string-kind and pgEnum columns, does a `::text` cast fix it, and does SQLite LIKE work on numeric columns?
source: scratch probe (drizzle-orm 0.45.3 + @electric-sql/pglite 0.5.8 + better-sqlite3 13.0.3, Node 24.21.0) and source reading of drizzle-orm/errors.js
fetched: 2026-10-07
expires: 2026-11-06
---
Learned (PG): `ilike(col, pattern)` fails with SQLSTATE 42883 ("operator does not exist: <type> ~~* unknown") for uuid, numeric, interval, timestamp({mode:"string"}), date() and date({mode:"date"}) columns and for pgEnum columns. It works on text. `ilike(sql\`${col}::text\`, pattern)` works for all of them, including text. The generated SQL is `"t"."m"::text ilike $1` with the pattern as a bound parameter.
Learned (SQLite): `sql\`${col} like ${pattern} escape '\\'\`` matched a `numeric()` column whose value was stored as REAL (12.5 matched `%2.5%`).
Learned (errors): the PGlite failure surfaces as a `DrizzleQueryError` (exported from `drizzle-orm`; `err.name` is "Error", so test with `instanceof`, not `name`) whose `cause.code` holds the SQLSTATE.
Unknown: whether `text_col::text` still lets PG use an expression or trigram index on the column (not probed; irrelevant for `%q%` patterns without pg_trgm).
