# 011: Classify DB errors by code along the cause chain; never show raw messages

- Date: 2026-10-07
- Status: accepted

## Context
§9: DB errors such as unique violations appear as form-level errors. §8: FK failures on delete appear as an error message.

## Decision
`classifyDbError(err)` walks `err` and up to 5 levels of `.cause` and maps `code`:
- `SQLITE_CONSTRAINT_UNIQUE`, `SQLITE_CONSTRAINT_PRIMARYKEY`, `23505` → `unique`
- `SQLITE_CONSTRAINT_FOREIGNKEY`, `23503` → `foreignKey`
- `SQLITE_CONSTRAINT_NOTNULL`, `23502` → `notNull`
- otherwise → `other`

Users see only a fixed Japanese message per class; `err.message` is never rendered. The server log line (`console.error`) contains the class, the error name and the code only.

## Alternatives considered
- Display `err.message`: PG errors arrive as `DrizzleQueryError`, whose message contains the SQL and the bound parameters (possibly passwords).
- Regex on messages: brittle across drivers.

## Rationale
better-sqlite3 throws `SqliteError` with `code`; PGlite errors are wrapped in `DrizzleQueryError` with `cause.code` 23505/23503 (evidence: 2026-10-07-drizzle-driver-runtime-behavior). The NOT NULL codes were not probed (unverified).

## Consequences
- Other drivers (node-postgres, postgres-js, libsql) are expected to expose PG/SQLite codes similarly; unverified, and outside the test matrix.
