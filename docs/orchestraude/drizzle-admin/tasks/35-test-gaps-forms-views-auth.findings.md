# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [quality] Nullable FK empty-choice case overlaps an existing test
  - location: test/fields.test.ts:326
  - detail: The new nullable row (no fkChoices entry, only the empty choice) is close to the existing 'adds the empty choice to a nullable FK select' test, which also uses withMeta notNull:false. They differ in input (no entry vs a choices list), so both are defensible, but the overlap could be noted or merged.
  - evidence: (none)
- [tests] DisplayValue test checks two unrelated cases in one it.each row
  - location: test/widgets.test.ts:253
  - detail: The date-only Date and json assertions share one test per zone. The adopted convention is one case per row, so a failure in the first assertion hides the second. Split into rows of {zone, field, value, expected}.
  - evidence: (none)

