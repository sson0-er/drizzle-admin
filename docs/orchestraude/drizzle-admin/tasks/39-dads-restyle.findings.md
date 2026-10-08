# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] Duplicate token values
  - location: src/static/admin-css.ts:8
  - detail: --error-fg has the same value as --danger in both schemes, and --focus-fill and --on-focus-fill are identical across schemes (they are redeclared in the dark block). Both are design-given token values, so this is optional.
  - evidence: (none)
- [spec] Pinned values it.each runs over tokens, not over scheme
  - location: test/admin-css.test.ts:146
  - detail: The DoD and test-strategy.md say 'Pinned values (it.each over scheme)'. The test runs it.each over the six tokens and asserts light and dark inside each case, so all twelve values are pinned and the coverage is complete. Only the table shape differs: a wrong dark value is reported under a case named for both values. Optional: use one row per (scheme, token, value), the same way the `schemes` table is used for the structure tests.
  - evidence: (none)
- [tests] Pair lists pinned only by length
  - location: test/admin-css.test.ts:165
  - detail: The 'one to one' check asserts only toHaveLength(24) and toHaveLength(9). Swapping or dropping a pair while adding another would still pass. Compare the lists to a literal, or drop the test, since the lists are already literals in the file.
  - evidence: (none)
- [tests] Block lookup by first substring occurrence is fragile
  - location: test/admin-css.test.ts:191
  - detail: block(ADMIN_CSS, "table {") and block(ADMIN_CSS, "body {") match the first substring occurrence, so a later selector such as `.datatable {` or `#x body {` placed earlier could be picked silently. A match anchored to a line start or a preceding newline would make a failure point at the cause.
  - evidence: (none)

