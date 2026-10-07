---
id: 02-support-time
depends_on: [01-project-setup]
status: done
attempts: 0
---
# Task 02: support-time

## Goal
`src/time.ts` provides time-zone validation, `datetime-local` conversion, date-only (UTC calendar date) helpers, list date formatting and date-preset ranges, all independent of the process time zone.

## Scope
### Files to touch
- src/time.ts
- test/time.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/messages.ts and every other existing file

## Implementation notes
- Implement every function in `interfaces/support.md#srctimets` with the stated algorithms (`zonedParts` via `Intl.DateTimeFormat("en-US", { hourCycle: "h23", ... }).formatToParts`; `zonedToInstant` with the two-offset correction; DST gap → later valid instant, overlap → first occurrence).
- Never use local-time Date methods (`getDate`, `getHours`, `new Date(y, m, d)`, ...). Use `Date.UTC` and `getUTC*`.
- `parseDateOnly` accepts only `/^(\d{4})-(\d{2})-(\d{2})$/` with a real calendar date. All `parse*` return `null` for malformed input or impossible dates (re-derive the parts and compare).
- `resolveTimeZone` is the only function that throws: `Error('drizzle-admin: invalid timeZone "<tz>"')`.
- Preset definitions (today/past7/month/year, half-open `[start, end)`) are in decision 009. `calendarPresetRange` uses the same calendar dates as `datePresetRange` but returns UTC midnights (decision 019).
- No `node:` imports (Biome `noNodejsModules` for src).

## Definition of Done
- [ ] `src/time.ts` exports `DatePreset`, `resolveTimeZone`, `zonedParts`, `zonedToInstant`, `parseDatetimeLocal`, `parseDateOnly`, `toDatetimeLocal`, `toDateOnly`, `formatDateTime`, `formatDate`, `datePresetRange`, `calendarPresetRange` with the signatures in support.md.
- [ ] `grep -nE "\.(getDate|getHours|getMonth|getFullYear|getMinutes|getSeconds|getDay)\(" src/time.ts` finds nothing.
- [ ] Tests: `test/time.test.ts` verifies `parseDatetimeLocal`/`toDatetimeLocal` round trips in `Asia/Tokyo` and `America/New_York`, including a DST gap (later valid instant) and an overlap (first occurrence).
- [ ] Tests: `test/time.test.ts` verifies invalid inputs (`2026-13-01`, `2026-02-30`, `2026/10/07`, `2026-10-7`, `2026-10-07T00:00` for `parseDateOnly`, malformed `datetime-local`) return `null`, and `resolveTimeZone("Nope/Zone")` throws a message containing `drizzle-admin: invalid timeZone`.
- [ ] Tests: `test/time.test.ts` verifies `parseDateOnly("2026-10-07").toISOString() === "2026-10-07T00:00:00.000Z"`, `toDateOnly` and `formatDate` (`"2026/10/07"`) read UTC parts, and `formatDateTime` returns the `2026/10/07 14:05` format.
- [ ] Tests: `test/time.test.ts` verifies `datePresetRange` for each preset with a fixed `now`, and `calendarPresetRange("today", new Date("2026-10-06T16:00Z"), "Asia/Tokyo")` = `[2026-10-07T00:00Z, 2026-10-08T00:00Z)` and with `"America/New_York"` = `[2026-10-06T00:00Z, 2026-10-07T00:00Z)`, plus month and year boundary cases (e.g. `now` on Dec 31 / Jan 1 in the zone).
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md#srctimets
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "support")
- Decisions: docs/orchestraude/decisions/009-search-filter-sql.md (preset ranges), docs/orchestraude/decisions/019-date-only-calendar-dates.md
- Evidence: 2026-10-07-drizzle-pg-date-mapping

## History
- 2026-10-07: scope extended with the user's approval: added "!.claude" to files.includes in biome.json so Biome ignores Claude Code settings (not project source). .claude/settings.local.json itself was not edited.
