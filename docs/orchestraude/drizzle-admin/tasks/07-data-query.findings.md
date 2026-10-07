# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] parsePk is a pure alias of parseFieldValue
  - location: src/data/query.ts:117
  - detail: parsePk only delegates to parseFieldValue. It is required by the design API, so keep it, but a one-line comment on why PK parsing shares field parsing would state the intent.
  - evidence: (none)
- [quality] Duplicated integer regex and BigInt/number parsing
  - location: src/data/query.ts:98
  - detail: The /^-?\d+$/ pattern appears twice (integer and bigint branches). A shared constant would remove the duplication.
  - evidence: (none)
- [spec] Date-before-FK branch precedence has no test
  - location: src/data/query.ts:67
  - detail: The task notes and data.md require the date branch to be checked before the FK branch (a date-kind or date-only FK filters by presets). The code does this, but no test covers a date-kind or date-only FK column, so a reordering would go unnoticed. Consider adding a small ad-hoc table in the test with a date-only FK column and asserting that a preset value produces a range condition. This is not a DoD item.
  - evidence: (none)
- [tests] Date-kind FK precedence and unknown-column error untested
  - location: test/query.test.ts
  - detail: buildFilters checks the date branch before the FK branch, and columnOf throws on an unknown column. Neither is tested. Add a case with a date-kind FK field (or document why none exists in the fixtures) and an expect(...).toThrow for columnOf via buildOrderBy or buildSearch.
  - evidence: (none)
- [tests] Date presets other than today/month only partly exercised
  - location: test/query.test.ts:106
  - detail: past7 and year are never run through buildFilters, and date-only fields are only tested with today. Turning the date tests into an it.each over presets would exercise the remaining dateRange branches cheaply.
  - evidence: (none)
- [tests] Invalid-value test bundles unrelated assertions
  - location: test/query.test.ts:166
  - detail: One test holds six invalid-value assertions, so a failure does not name the failing input. Use it.each with the input as the case name.
  - evidence: (none)

