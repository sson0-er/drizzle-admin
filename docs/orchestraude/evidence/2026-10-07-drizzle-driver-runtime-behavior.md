---
id: 2026-10-07-drizzle-driver-runtime-behavior
question: How do drizzle-orm 0.45.3 better-sqlite3 and pglite drivers behave for returning, count, LIKE escaping and constraint errors?
source: scratch vitest probe, drizzle-orm 0.45.3 + better-sqlite3 13.0.3 + @electric-sql/pglite 0.5.8 (drizzle-orm/pglite) on Node 24.21.0
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: `drizzle-orm/pglite` works with PGlite 0.5.8. `.insert().values().returning()` returns the row on both drivers; `await` works on better-sqlite3 builders. `select({ n: count() })` yields a JS number on both.
Errors: better-sqlite3 throws `SqliteError` directly with `code` SQLITE_CONSTRAINT_UNIQUE / SQLITE_CONSTRAINT_FOREIGNKEY. PGlite errors are wrapped in `DrizzleQueryError` (message contains the SQL and the bound params) with `cause.code` 23505 (unique) / 23503 (foreign key).
LIKE: drizzle `like()` on SQLite emits `like ?` with no ESCAPE clause and SQLite has no default escape char, so `\%` is not an escape; `sql\`${col} like ${pattern} escape '\\'\`` (pattern bound as a parameter) escapes correctly and SQLite LIKE is ASCII case-insensitive. On PG `ilike()` with `\%` in the pattern matched a literal % (backslash is PG's default escape).
SQLite introspection: `integer().primaryKey({autoIncrement:true})` -> autoIncrement true, hasDefault true; plain `integer().primaryKey()` -> autoIncrement false but hasDefault true.
Unknown: NOT NULL error codes (expected SQLITE_CONSTRAINT_NOTNULL / 23502, not probed).
