---
id: 17-forms-coerce-validate
depends_on: [16-forms-fields, 02-support-time]
status: done
attempts: 0
---
# Task 17: forms-coerce-validate

## Goal
Submitted form strings are turned into typed values (§9 coercion) for editable fields only, validated by a generated zod schema and then by the user's `validate`, with field and form errors expressed only through `messages`.

## Scope
### Files to touch
- src/forms/coerce.ts
- src/forms/schema.ts
- src/forms/validate.ts
- test/coerce.test.ts
- test/schema.test.ts (zod schema and the `validateSubmission` pipeline)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/forms/fields.ts (bug fixes only, recorded in History), src/time.ts, src/messages.ts
- src/routes/**, src/views/**

## Implementation notes
- Coercion rules 1-3 in order, mass-assignment protection, multi-value and `File` handling, trimming rules: `interfaces/forms.md#coercets`. Rule 1 keys on kind boolean only. FK fields coerce by their own kind.
- Date: `isDateOnly` → `parseDateOnly(raw.trim())` (UTC midnight, never the time zone); otherwise `parseDatetimeLocal(raw.trim(), timeZone)`.
- Date-only string (kind string + `isDateOnly`): `v = raw.trim()`; `parseDateOnly(v) === null` → `invalidDate`; else the value is `v` (a string, not a Date).
- The widget never changes coercion (decision 021): e.g. a `text` override on a number field still yields a number.
- zod schema per field and issue mapping (`{ [path[0]]: messages.invalidValue }`, first issue per field): `interfaces/forms.md#schemats`. zod's own messages are never shown.
- Pipeline order and error mapping (editable keys → field errors, other keys → form errors; stop at the first failing step; a throwing `validate` is not caught): `interfaces/forms.md#validatets`. `values` in a failed result are `rawValues(...)`.

## Definition of Done
- [ ] Tests: `test/coerce.test.ts` verifies every rule: boolean present/`"0"`/`"false"`/missing; empty → `null` when nullable, omitted when notNull + hasDefault + add, `messages.required` otherwise (including change mode with a default); number finite / `invalidNumber` / `invalidInteger` for `1.5` on an integer field; bigint ok and `invalidInteger`; timestamp `datetime-local` in `Asia/Tokyo`; json ok and `invalidJson`; enum ok and `invalidChoice`; strings not trimmed.
- [ ] Tests: `test/coerce.test.ts` verifies date-only: `"2026-10-07"` → `2026-10-07T00:00:00.000Z` for both `Asia/Tokyo` and `America/New_York`; date-only string: `"2026-10-07"` and `" 2026-10-07 "` → the string `"2026-10-07"` (`typeof` string); `"2026-02-30"`, `"2026/10/07"`, `"2026-10-7"`, `"2026-10-07T00:00"` → `invalidDate`; `""` → `null` when nullable.
- [ ] Tests: `test/coerce.test.ts` verifies mass assignment (body keys that are not editable fields, e.g. `id` and `unknown`, are absent from `data`), the last value of a multi-valued key is used, a `File` counts as missing, and a `text` override on a number field still yields a number.
- [ ] Tests: `test/schema.test.ts` verifies the zod schema: nullable, optional on add for notNull + hasDefault, `.int()` rejects a non-integer, and failures map to `messages.invalidValue`.
- [ ] Tests: `test/schema.test.ts` verifies `validateSubmission`: coercion errors stop before zod and `validate`; `validate` returning `{ <editableKey>: "m1", other: "m2" }` yields field error `m1` and form error `m2`; `validate` receives `{ mode }`; failed results carry the raw submitted values.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (sections "coerce.ts", "schema.ts", "validate.ts")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md (`parseDateOnly`, `parseDatetimeLocal`, messages)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "forms")
- Decisions: docs/orchestraude/decisions/019-date-only-calendar-dates.md, 021-widget-override-compatibility.md, 023-pg-date-string-mode-support.md
- Evidence: 2026-10-07-drizzle-pg-date-mapping, 2026-10-07-pg-date-string-mode-filtering

## History
