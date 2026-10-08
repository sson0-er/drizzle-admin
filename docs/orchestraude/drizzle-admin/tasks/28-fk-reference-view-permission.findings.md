# Review findings

high: 0, medium: 0, low: 1

## high


## medium


## low

- [tests] No test that no getMany/options query runs for a hidden FK
  - location: test/auth.test.ts:640
  - detail: The DoD requires that no getMany and no options query run for an FK whose referenced model is not viewable. The tests assert only the rendered output (no names, no link, no filter). A regression that queried but did not render would pass. Optionally spy on repo.getMany/repo.options, or leave as is since the output is what matters.
  - evidence: (none)

