---
id: 2026-10-07-pg-date-string-mode-filtering
question: For PG `date()` (string mode, PgDateString) in drizzle-orm 0.45.3, do `YYYY-MM-DD` string bounds work for range filters, and what does PG do with malformed or impossible date strings?
source: scratch probe (drizzle-orm 0.45.3 + @electric-sql/pglite 0.5.8, Node 24.21.0, process TZ Asia/Tokyo and America/New_York)
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: `date()` reports `columnType` `PgDateString` and `dataType` `string`. `and(gte(col, "2026-10-07"), lt(col, "2026-10-08"))` binds the two strings unchanged as parameters (`"due" >= $1 and "due" < $2`) and returned exactly the rows stored as 2026-10-07. Values read back as the strings `"2026-10-07"`. `orderBy(asc(col))` sorts chronologically (nulls last). Results were identical under both process time zones. `ilike(sql\`${col}::text\`, "%10-07%")` matched the expected rows.
Learned: PG rejects an impossible date `"2026-02-30"` with SQLSTATE 22008 (classified as `other`, so it would surface as the generic `dbOther` message). PG accepts `"2026/10/07"` and stores 2026-10-07, so PG does not enforce the `YYYY-MM-DD` input format by itself.
Unknown: other drivers (node-postgres, postgres-js, neon) were not probed for string-mode dates; they are expected to behave the same because drizzle passes strings through, but this is unverified. The PG `DateStyle` setting was not varied.
