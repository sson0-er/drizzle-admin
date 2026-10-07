# 009: Search and filter SQL construction

- Date: 2026-10-07
- Status: accepted

## Context
§7: substring search with `ilike` on PG and `like` on SQLite, wildcards escaped, date presets, no `sql.raw` with user input.

## Decision
Changed 2026-10-07: PG search casts every column to text (decision 018); date presets on date-only fields use UTC-midnight calendar bounds (decision 019).

- `escapeLike(s)` escapes `\` → `\\`, `%` → `\%`, `_` → `\_`; the pattern is `%<escaped>%`.
- PostgreSQL: ``ilike(sql`${column}::text`, pattern)`` (backslash is PG's default LIKE escape; cast per decision 018).
- SQLite: ``sql`${column} like ${pattern} escape '\'` `` (the `escape '\'` literal is a constant in the template; the pattern is a bound parameter). Drizzle's `like()` is not used on SQLite.
- The whole trimmed `q` is one term, OR-ed across `searchFields` (no word splitting).
- `searchFields` must be string or enum kind (checked by `register()`). On PG these include non-text types (uuid, numeric, pgEnum, ...), hence the `::text` cast (decision 018).
- Date presets are half-open instant ranges `[start, end)` computed in `config.timeZone`: `today` = [today 00:00, tomorrow 00:00), `past7` = [today-6d 00:00, tomorrow 00:00), `month` = [1st of month, 1st of next month), `year` = [Jan 1, next Jan 1). For date-only fields the same calendar dates are used, but the bounds are UTC midnights (decision 019).

## Alternatives considered
- drizzle `like()` on SQLite: emits no ESCAPE clause, so `\%` is not an escape there.
- Splitting `q` into words AND-ed (Django style): not asked for in §7.

## Rationale
Without ESCAPE, SQLite treated `\%` literally and matched the wrong row; with `escape '\'` it matched only the literal `%`. PG `ilike` with `\%` matched the literal `%` (evidence: 2026-10-07-drizzle-driver-runtime-behavior).

## Consequences
- Searching numeric columns is not supported (rejected at registration).
