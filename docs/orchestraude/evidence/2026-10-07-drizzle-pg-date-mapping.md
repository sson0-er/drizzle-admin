---
id: 2026-10-07-drizzle-pg-date-mapping
question: How does drizzle-orm 0.45.3 map PG `date` columns (mode "date" and mode "string") to and from the driver, and does the configured time zone shift date-only values?
source: scratch probe (drizzle-orm 0.45.3 + @electric-sql/pglite 0.5.8, Node 24.21.0, process TZ Asia/Tokyo, America/New_York, UTC) and source reading of drizzle-orm/pg-core/columns/date.js, pglite/session.js, node-postgres/session.js, postgres-js/driver.js
fetched: 2026-10-07
expires: 2026-11-06
---
Learned (source): `date({mode:"date"})` (PgDate) has `mapToDriverValue(v) = v.toISOString()` and `mapFromDriverValue(s) = new Date(s)`. So a `"YYYY-MM-DD"` string read back becomes UTC midnight. `date()` (PgDateString) passes strings through in both directions. The drizzle pglite, node-postgres and postgres-js drivers install DATE type parsers that return the raw string, so the read path is the same on these drivers.
Learned (runtime): when a Date at 00:00 Asia/Tokyo for 2026-10-07 was inserted, PG stored `2026-10-06`, because PG keeps the date part of `2026-10-06T15:00:00.000Z`. A Date at `Date.UTC(2026,9,7)` stored `2026-10-07` under every process TZ tested, and it read back as `2026-10-07T00:00:00.000Z`. `gte(dateCol, Date)` binds the param as `toISOString()` (e.g. `"2026-10-07T00:00:00.000Z"`). Filtering with UTC-midnight bounds `[10-07, 10-08)` matched exactly the rows stored as 2026-10-07. `date()` returned the string `"2026-10-07"`.
Conclusion: date-only values round-trip correctly only as UTC-midnight Dates. Any non-UTC offset in the Date passed to drizzle changes the stored day.
Unknown: other drivers (neon-http, mysql) were not probed. The PG session TimeZone setting does not affect `date` input parsing in the cases probed, but it was not varied.
