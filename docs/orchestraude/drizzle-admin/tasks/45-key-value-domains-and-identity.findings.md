# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] forms/coerce.ts now imports from data/query.ts
  - location: src/forms/coerce.ts:1
  - detail: The forms layer now depends on the data layer for a pure string-to-number parse. It works and avoids duplicating the rules, but a shared pure parser module would keep the layering clean. Preference only.
  - evidence: (none)
- [quality] Integer range lookup in parseFieldValue is roundabout
  - location: src/data/query.ts:112
  - detail: The ternary that narrows valueCheck to int16/int32 before indexing INT_RANGES, followed by a second conditional, is harder to read than a plain lookup, for example a Record<string, [number, number]> read with an undefined check. Style only.
  - evidence: (none)
- [spec] PG/SQLite views=3000000000 outcome uses an inline conditional instead of an it.each row per dialect or a lookup table
  - location: test/form.test.ts:491
  - detail: The task notes ask for one it.each row per dialect outcome or a fixture.name lookup table. The test instead uses a ternary for the status and an `if (fixture.name === "pglite")` around the invalidInteger assertion. The behavior is the same and covered on both dialects, but the expected outcome is not declared as data. Optionally, put the expected status and error in a `{ pglite: ..., sqlite: ... }` table keyed by fixture.name.
  - evidence: (none)
- [tests] Form-level hex case duplicates coerce unit test
  - location: test/form.test.ts:416
  - detail: The 'hexadecimal integer' row exercises the same branch as the '0x1F' row in test/coerce.test.ts; it only adds route wiring already covered by the other invalid-integer rows. Could be dropped.
  - evidence: (none)
- [tests] Conditional assertions inside one test depending on dialect
  - location: test/form.test.ts:491
  - detail: The int4-overflow test branches on fixture.name for status and error checks, so the SQLite run asserts only 303 and nothing about the stored value. Split into a pglite-only test and a sqlite-only test (or assert the stored row) so each failure points at one behavior.
  - evidence: (none)
- [tests] int16 lower bound and bigint-range-less case not tested
  - location: test/query.test.ts:321
  - detail: The table has int16 max/above-max but no int16 min/below-min row, and no bigint field without valueCheck (SQLite) accepting a value above int64. Add two rows.
  - evidence: (none)

