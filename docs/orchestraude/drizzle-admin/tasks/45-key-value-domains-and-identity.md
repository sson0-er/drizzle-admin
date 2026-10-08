---
id: 45-key-value-domains-and-identity
depends_on: [44-permission-inheritance-and-hidden-models]
status: done
attempts: 0
---
# Task 45: key-value-domains-and-identity

## Goal
Security audit fixes, part 3 (input outside the DB's value domain, identity columns):
- Introspection records a PG column's DB-enforced value domain in `FieldMeta.valueCheck` (`int16` / `int32` / `int64` / `uuid`; absent on SQLite and for other types), and marks identity columns, PK or not, as `isGenerated` (decisions 045 point 1, 046 point 2).
- `parseFieldValue` / `parsePk` return `null` for values the DB would reject: integers outside the PG int2/int4/int8 range, a non-uuid string for a uuid column, any string with U+0000, an enum value not in `enumValues`. The existing callers already turn `null` into 404 / skipped / filter ignored, so these requests stop producing 500s (decision 045 points 1 and 6).
- Form coercion of integer and bigint fields goes through `parseFieldValue`: `0x1F`, `0b11`, `1e3`, `1.5`, `+5` and unsafe integers are `invalidInteger`, and a PG int4 field rejects `3000000000` as `invalidInteger` (decision 045 point 4).
- A non-PK identity column is omitted on the add page and display-only on the change page (forms.md editability table, through `isGenerated`).

Source findings: docs/orchestraude/drizzle-admin/security-audit/data.findings.json, docs/orchestraude/drizzle-admin/security-audit/dynamic.md (item 6b).

## Scope
### Files to touch
- src/introspect/index.ts (`FieldMeta.valueCheck`, the `isGenerated` and `valueCheck` mapping, `toSnapshot` if it lists fields explicitly); src/introspect/pg.ts only if the columnType mapping is placed there
- src/data/query.ts (only `parseFieldValue`; `parsePk` keeps delegating to it)
- src/forms/coerce.ts (only the number and bigint branches of rule 3, plus the import)
- test/introspect.pg.test.ts and test/__snapshots__/introspect.pg.test.ts.snap, test/introspect.sqlite.test.ts
- test/query.test.ts, test/coerce.test.ts, test/fields.test.ts
- test/list.test.ts (new PG-only cases), test/form.test.ts (new cases)

### Do not touch
- src/routes/** (no handler change is needed: callers already map `null` to 404 / skip / ignore, data.md), src/admin.ts, src/types.ts
- src/forms/fields.ts (the editability table already keys on `isGenerated`), src/forms/schema.ts, src/forms/validate.ts, src/forms/widgets.tsx
- `buildSearch`, `buildFilters`, `buildOrderBy` and the repository (src/data/repository.ts)
- src/introspect/sqlite.ts; test/__snapshots__/introspect.sqlite.test.ts.snap must not change
- test/helpers/**, test/fixtures/** (tables needed only by a test are defined inside that test file), every other test file
- README.md, CHANGELOG.md, CLAUDE.md (task 48), package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Do not delete, weaken or skip an existing assertion. The PG snapshot may change only as stated in the Definition of Done.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact values and messages.

- **Introspection** (introspect.md, `FieldMeta` block and the flag table rows `isGenerated` and `valueCheck`):
  - `isGenerated`: `column.generated !== undefined || column.generatedIdentity !== undefined` (evidence 2026-10-08-pg-key-input-domains: drizzle leaves `generated` undefined on identity columns).
  - `valueCheck?: "int16" | "int32" | "int64" | "uuid"`, set only for PG columnTypes `PgSmallInt`, `PgSmallSerial` → `int16`; `PgInteger`, `PgSerial` → `int32`; `PgBigInt53`, `PgBigSerial53`, `PgBigInt64`, `PgBigSerial64` → `int64`; `PgUUID` → `uuid`. Otherwise the property is absent (not `undefined`-valued), so SQLite snapshots stay identical. Drizzle column internals are read only in src/introspect/ (CLAUDE.md design principles).
- **`parseFieldValue`** (data.md, the "`parsePk` / `parseFieldValue` by `field.kind`" rules):
  - number, `isInteger`: `/^-?\d+$/`, `Number.isSafeInteger`, then `int16` → -32768..32767, `int32` → -2147483648..2147483647 (inclusive); no `valueCheck` → no further bound. Non-integer numbers unchanged.
  - bigint: `/^-?\d+$/` → `BigInt`; `int64` → -9223372036854775808n..9223372036854775807n.
  - string: `null` if it contains U+0000; `uuid` → must match `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
  - enum: the raw value only if it is in `field.enumValues`, else `null`.
- **Coercion** (forms.md `coerce.ts`, rule 3 "number" and "bigint"): number keeps the whitespace-only and `Number(t)` finite checks (`invalidNumber`); then for `isInteger` the value is `parseFieldValue(meta, t)`, `null` → `invalidInteger`. bigint: `parseFieldValue(meta, t)`, `null` → `invalidInteger`. Import `parseFieldValue` from `../data/query.js` (forms.md "Inputs"; the component table in docs/orchestraude/drizzle-admin/03-design/README.md: forms depends on data for `parseFieldValue` only).
- **Tests** (test-strategy.md "Security audit fixes": the `introspect.pg.test.ts`, `query.test.ts` and `coerce.test.ts` bullets and the `list.test.ts` / `form.test.ts` parts of the "Input bounds" bullet):
  - test/introspect.pg.test.ts: a table defined in the test with a serial PK plus non-PK `integer().generatedByDefaultAsIdentity()` and `integer().generatedAlwaysAsIdentity()` columns → both `isGenerated: true`, `isAutoIncrement: false`. `valueCheck` per column type (it.each, columns defined in the test): `smallint` `int16`; `integer` and `serial` `int32`; `bigint({ mode: "number" })`, `bigint({ mode: "bigint" })` `int64`; `uuid` `uuid`; `text`, `varchar` → no `valueCheck` property. Update the snapshot with `pnpm vitest run test/introspect.pg.test.ts -u` only after the new code is in place.
  - test/introspect.sqlite.test.ts: no field of any fixture table has a `valueCheck` property.
  - test/query.test.ts `parseFieldValue` (it.each, test-built `FieldMeta`): int32 `"2147483647"`, `"-2147483648"` → numbers, `"2147483648"`, `"-2147483649"` → `null`; int16 `"32767"` → number, `"32768"` → `null`; int64 bigint `"9223372036854775807"` → bigint, `"9223372036854775808"` → `null`; integer without `valueCheck` `"3000000000"` → `3000000000`; uuid `"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"` and its upper-case form → the string, `"abc"`, `"{a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11}"` and the hyphen-less form → `null`; a string containing `"\u0000"` → `null`; enum value in `enumValues` → the value, another → `null`.
  - test/coerce.test.ts (it.each): integer number field `"0x1F"`, `"0b11"`, `"1e3"`, `"1.5"`, `"+5"`, `"9007199254740993"` → `invalidInteger`; `"abc"` → `invalidNumber`; `" 42 "` → `42`; int32 field `"3000000000"` → `invalidInteger`; int64 bigint field `"9223372036854775808"` → `invalidInteger`; non-integer number field `"1e3"` → `1000`.
  - test/fields.test.ts (planner addition for the identity editability, forms.md table): a PG table defined in the test with a non-PK `integer().generatedByDefaultAsIdentity()` column: the add-mode groups do not contain it, and in change mode it is display-only.
  - test/list.test.ts, a `describe` for `pglite` only: `articles` with `listFilter: ["authorId"]`, `?f_authorId=3000000000` → 200 with the same `_selected` row values as the unfiltered list; `GET /admin/authors/3000000000/change/` and `GET /admin/authors/3000000000/delete/` → 404 (it.each).
  - test/form.test.ts, both dialects: `articles` add with an otherwise valid form and `views=0x1F` → 400 with `messages.invalidInteger` on the `views` field. `views=3000000000` → 400 with `messages.invalidInteger` on PG, 303 on SQLite (one it.each row per dialect outcome, or a `fixture.name` lookup table).
- Write the new tests first and run them against the unchanged code. They must fail there (e.g. PG `3000000000` key → 500, `"0x1F"` → 31 accepted, identity column `isGenerated: false`). Record the received values in History.
- No export or prop beyond the design is expected (`valueCheck` is in introspect.md). If one is added, record it in History.

## Definition of Done
- [ ] `FieldMeta` has `valueCheck?: "int16" | "int32" | "int64" | "uuid"`; `isGenerated` reads both `generated` and `generatedIdentity`.
- [ ] `parseFieldValue` follows every rule above; `parsePk` still only delegates to it.
- [ ] src/forms/coerce.ts imports `parseFieldValue` from `../data/query.js` and calls it for `isInteger` number fields and for bigint fields; non-integer number fields still use `Number(t)`.
- [ ] Tests (test/introspect.pg.test.ts, test/introspect.sqlite.test.ts): the identity, `valueCheck` and SQLite no-`valueCheck` cases pass. `git diff test/__snapshots__/introspect.pg.test.ts.snap` consists only of added `"valueCheck": ...` lines on PG integer, serial, bigint and uuid fields and the `tags.id` change `"isGenerated": false` → `"isGenerated": true`. `git diff --quiet test/__snapshots__/introspect.sqlite.test.ts.snap` exits 0.
- [ ] Tests (test/query.test.ts, test/coerce.test.ts, test/fields.test.ts): every row listed in Implementation notes passes.
- [ ] Tests (test/list.test.ts, PG only): `f_authorId=3000000000` → 200 with the unfiltered rows; the two out-of-range change/delete URLs → 404.
- [ ] Tests (test/form.test.ts): `views=0x1F` → 400 `invalidInteger` on both dialects; `views=3000000000` → 400 `invalidInteger` on PG and 303 on SQLite.
- [ ] History records that the new tests failed against the pre-change code, with the received values.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/introspect.md (`FieldMeta`, flag table rows `isGenerated` and `valueCheck`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (`src/data/query.ts` rules, `parsePk` / `parseFieldValue`; "Invalid PK strings never reach SQL")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (Inputs line; editability table; `coerce.ts` rule 3)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md ("Security audit fixes (decisions 042-048)")
- Decisions: docs/orchestraude/decisions/045-request-input-bounds.md (points 1, 4, 6), docs/orchestraude/decisions/046-column-exposure-defaults.md (point 2)
- Evidence: docs/orchestraude/evidence/2026-10-08-pg-key-input-domains.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

### Attempt 1: blocked
- New tests were written first and run against the unchanged code; they failed as required. Received values: coerce `"0x1F"`, `"0b11"`, `"1e3"`, `"+5"`, `"9007199254740993"`, int32 `"3000000000"`, int64 `"9223372036854775808"` all accepted (`errors` was `{}`); `parseFieldValue` returned `2147483648`, `-2147483649`, `32768`, `9223372036854775808n`, `-9223372036854775809n` for out-of-range ints, and returned `"abc"`, `"{a0eebc99-...}"`, the hyphen-less string and a NUL string unchanged (uuid / NUL cases) instead of `null`; identity columns had `isGenerated: false` and `valueCheck` was `undefined`; fields test add groups were `["id","seq","label"]`; PG list `?f_authorId=3000000000` and `/authors/3000000000/change|delete/` returned 500; PG add with `views=3000000000` returned no `invalidInteger` error; `views=0x1F` returned 303.
- Implementation is in place and every new test passes, typecheck, lint and build pass, the SQLite snapshot is unchanged, the PG snapshot diff is only `valueCheck` lines plus `tags.id` `isGenerated` false -> true.
- Blocked: `scripts/verify.sh` fails on the existing test/schema.test.ts "stops at zod errors before validate" (line ~120). It submits `age: "9007199254740993"` and expects coercion to accept it and zod to answer `messages.invalidValue`. Per this task (forms.md rule 3) coercion now answers `messages.invalidInteger` for that value, so the assertion cannot hold. test/schema.test.ts is outside "Files to touch" and may not be changed.

### Attempt 1 (continued): still blocked on test/schema.test.ts
- The coordinator allowed rewriting "stops at zod errors before validate" with an input that passes coercion but fails zod. I checked every kind against `coerceForm` and `buildZodSchema`: after this task coercion yields exactly the types zod expects (number: finite, integer and safe for `isInteger`; bigint; boolean; Date, never Invalid Date because the datetime regex is 4-digit; enum from the same `enumValues`; string/json/unknown accept anything; empty and password-on-change cases are skipped consistently in both). No user input reaches a zod rejection any more; the zod layer is now purely defensive, so the test cannot be rewritten with a real input. test/schema.test.ts was left unchanged.

### Attempt 1 (final): done
- Deleted the test "stops at zod errors before validate" from test/schema.test.ts (coordinator decision). Reason: it relied on coercion accepting `age: "9007199254740993"` and zod's `.int()` rejecting it; after decision 045 coercion rejects that value with `invalidInteger`, and no input passes coercion but fails zod. The ordering "coercion errors stop before zod and validate" stays covered by "stops at coercion errors before zod and validate". No other change in that file.
- scripts/verify.sh passes (1488 tests passed, 3 skipped; typecheck, lint, build clean).
- Review round 1: high 0, medium 0, low 6 (see findings.md; includes the dialect ternary in test/form.test.ts:491 and missing int16 lower-bound / no-valueCheck bigint rows). Done.
