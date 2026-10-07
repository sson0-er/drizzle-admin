# 019: Date-only values are UTC-midnight calendar dates

- Date: 2026-10-07
- Status: accepted

## Context
For `isDateOnly` fields (PG `date({mode:"date"})`), the design parsed `YYYY-MM-DD` as 00:00 in `config.timeZone`, formatted with the time zone, and computed date presets as time-zone instants. Design review finding: drizzle sends such Dates with `toISOString()`, so in zones east of UTC the stored date moves back by one day.

## Decision
- A date-only value is a `Date` at UTC midnight of the calendar date (`new Date(Date.UTC(y, m - 1, d))`). It is never interpreted in `config.timeZone`.
- `time.ts`: `parseDateOnly(value)` returns the UTC midnight. `toDateOnly(date)` and `formatDate(date)` read UTC parts (`getUTCFullYear/Month/Date`). None of the three takes a time zone.
- Date-preset filters on date-only fields use `calendarPresetRange(preset, now, tz)`. It takes "today" as the calendar date of `now` in `config.timeZone`, so a Tokyo admin's "today" is the Tokyo date. It returns the half-open range `[start, end)` as UTC midnights of the boundary calendar dates. Timestamp fields keep `datePresetRange` (instants in `config.timeZone`, decision 009).
- Coercion, `toFormValue` and list/display formatting select the date-only path by `FieldMeta.isDateOnly`, not by widget.
- PG `date()` (string mode) stays kind string (decision 010). Drizzle passes its value through as a `YYYY-MM-DD` string, so the time zone does not affect it.
  Changed 2026-10-07: it now also has `isDateOnly` and gets the date widget and date-preset filters, with values kept as `YYYY-MM-DD` strings; `calendarPresetRange` bounds are bound as `toDateOnly` strings for it (decision 023).

## Alternatives considered
- Keep the time-zone midnight and convert to UTC midnight only at the repository boundary: date-only knowledge would end up in two places (forms and data), and the display path would still need UTC formatting.
- Send `YYYY-MM-DD` strings to PgDate: `mapToDriverValue` calls `toISOString()`, so a string throws. This would need a custom column or `sql` casts.
- Map PgDate to kind string like PgDateString: loses the date widget and the date-preset filter.

## Rationale
In drizzle 0.45.3, PgDate maps a Date to the driver with `toISOString()` and reads the driver string back with `new Date("YYYY-MM-DD")`, which is UTC midnight. The pglite, node-postgres and postgres-js drivers return DATE as a raw string. A 00:00 Asia/Tokyo Date was stored as the previous day, while UTC-midnight Dates round-tripped correctly under every process TZ tested. Filtering with UTC-midnight bounds matched exactly (evidence: 2026-10-07-drizzle-pg-date-mapping).

## Consequences
- Source code must not use local-time Date methods (`getDate`, `getHours`, `setHours`, `new Date(y, m, d)`, ...). All time-zone math goes through `time.ts` (`Intl`) and all date-only math uses UTC methods.
- A PG integration test round-trips a `date({mode:"date"})` field through add, change, list and the "today" filter, with `timeZone` set to `Asia/Tokyo` and to `America/New_York`.
