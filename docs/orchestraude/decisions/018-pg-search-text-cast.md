# 018: Cast every PostgreSQL search column to text

- Date: 2026-10-07
- Status: accepted (supersedes the "no casts are needed" line of decision 009)

## Context
`register()` accepts `searchFields` of kind string or enum (decision 013 item 13). On PostgreSQL many kind-string columns are not text types (uuid, numeric, interval, `date()`, `timestamp({mode:"string"})`), and pgEnum columns are not text either. Design review finding: PG `ilike` on these columns raises a SQL error, which becomes a 500 for a configuration that `register()` accepted.

## Decision
- PostgreSQL: each search term is ``ilike(sql`${col}::text`, pattern)`` for every search field, text columns included. `::text` is a constant in the `sql` template, the column is interpolated as an identifier, and the pattern stays a bound parameter. `sql.raw` is not used.
- SQLite: unchanged (``sql`${col} like ${pattern} escape '\'` ``).
- The `register()` rule for `searchFields` (string or enum kind) is unchanged.

## Alternatives considered
- Add an `isTextLike` flag in introspect and reject non-text columns in `register()`: this also prevents the 500, but users could no longer search uuid, numeric or enum columns, which are common search targets in an admin UI. It also needs one more Drizzle-internal flag.
- Cast only non-text columns, using a flag from introspect: keeps `text` columns uncast in the SQL. It adds a flag and a code branch, and the benefit (possible index use) does not apply to `%q%` patterns without pg_trgm (unverified).

## Rationale
The probe showed `ilike(col, ...)` failing with 42883 on uuid, numeric, interval, string-mode timestamp, both date modes and pgEnum. `ilike(sql\`${col}::text\`, ...)` worked on all of them and on text, and produced `"t"."c"::text ilike $1` with a bound pattern (evidence: 2026-10-07-pg-search-non-text-columns). Backslash remains PG's default LIKE escape, so `escapeLike` still applies (evidence: 2026-10-07-drizzle-driver-runtime-behavior). SQLite LIKE matched a numeric column without a cast (evidence: 2026-10-07-pg-search-non-text-columns).

## Consequences
- Searching a `date({mode:"date"})` column on PG matches its text form `YYYY-MM-DD`. Such a column has kind date, so it cannot be a search field anyway.
- A PG repository test searches a uuid, a numeric and a pgEnum column.
