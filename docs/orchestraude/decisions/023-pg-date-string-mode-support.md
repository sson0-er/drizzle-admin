# 023: Date widget and date-preset filters for PG `date()` string-mode columns

- Date: 2026-10-07
- Status: accepted

## Context
Q5 (user decision 2026-10-07: yes). PG `date()` without `mode` (PgDateString, drizzle's default) has kind string (decision 010). Its values are `YYYY-MM-DD` strings (evidence: 2026-10-07-drizzle-pg-date-mapping). Before this decision it got a plain text input, could not be used in `listFilter`, and malformed input reached the DB as the generic `dbOther` error. The user asked for the date widget (`<input type="date">`) and the date-preset filters, with values kept as `YYYY-MM-DD` strings end to end (no Date conversion), consistent with decision 019 (the time zone only decides "today" for filters).

## Decision
- Representation: PgDateString keeps kind `string` and gets `isDateOnly: true`. `kind` stays the JS value type (`string` here, `date` for PgDate). `isDateOnly` now means "calendar-date column" for both kinds. Every date-only branch is keyed by `isDateOnly` plus `kind`:
  - kind date + `isDateOnly` (PgDate): UTC-midnight `Date` (decision 019, unchanged).
  - kind string + `isDateOnly` (PgDateString): a `YYYY-MM-DD` string, never converted to a `Date` as a value.
- Introspect: `isDateOnly` = columnType `PgDate` or `PgDateString`.
- Forms: default widget `date`. Allowed widgets `date`, `text`, `hidden` (same as PgDate). Coercion trims the raw value and accepts it only if `parseDateOnly` accepts it (strict `YYYY-MM-DD`, real calendar date), else `invalidDate`. The stored value is the trimmed string itself. zod stays `z.string()`. `toFormValue` returns the string unchanged.
- Data: `listFilter` accepts the field. The date-preset branch of `buildFilters` uses `calendarPresetRange(preset, now, timeZone)` (decision 019) and binds its bounds as `toDateOnly(start)` / `toDateOnly(end)` strings: `and(gte(col, "YYYY-MM-DD"), lt(col, "YYYY-MM-DD"))`. Search (`::text` cast, decision 018), ordering and PK parsing are unchanged.
- Views: list and display formatting are unchanged. The value is shown as stored (`2026-10-07`), by the existing "other → `String(value)`" rule.

## Alternatives considered
- Kind `date` with a sub-flag for the value type (e.g. `dateValue: "date" | "string"`): changes the meaning of `kind` (no longer the JS value type), so zod (`z.date()`), coercion, `toFormValue` and the `searchFields` kind rule (string/enum) would all need exceptions. It would also drop `date()` columns from `searchFields`, which work today (decision 018). More branches, more risk.
- Convert to/from UTC-midnight Dates at the repository boundary, reusing the PgDate path: the user ruled out Date conversion. It would also break the user-facing types, because `Row<T>` for `date()` is `string`, so `validate` and hooks would receive Dates where their types say string.
- Keep the plain text input (option (b) of Q5): rejected by the user.
- Display string-mode dates as `2026/10/07` like PgDate: not requested; the user asked for strings end to end. Not adopted.

## Rationale
- String bounds work: `gte(col, "2026-10-07")` / `lt(col, "2026-10-08")` on a `date()` column bind the strings unchanged and return exactly the rows of that date, under both Asia/Tokyo and America/New_York process time zones (evidence: 2026-10-07-pg-date-string-mode-filtering).
- Strict validation in the form is needed: PG rejects `2026-02-30` with SQLSTATE 22008 (would show `dbOther`) but silently accepts `2026/10/07`, so without the check the stored value would not match what the user typed in format (evidence: 2026-10-07-pg-date-string-mode-filtering).
- Drizzle passes PgDateString values through unchanged in both directions, so no time zone can shift them (evidence: 2026-10-07-drizzle-pg-date-mapping). The only time-zone use is picking "today" in `calendarPresetRange`, which matches decision 019.
- Other PG drivers were not probed for string-mode dates (unverified); drizzle's pass-through suggests the same behavior.

## Consequences
- `isDateOnly` no longer implies a `Date` value. Code must branch on `kind` before calling `toDateOnly` / `formatDate` (which take a `Date`).
- `register()` accepts `listFilter` on `date()` fields and rejects `textarea` / `password` widget overrides on them (they were allowed before; the library is unreleased, so this breaks no users).
- Tests: introspect snapshot (`date()` → string + isDateOnly), coercion cases, filter SQL params, a PG repository filter case and a PG integration round trip on a `date()` column of the `events` fixture.
- Decisions 010 and 019 point to this decision.
