# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] Needless alias wantedLocal
  - location: src/time.ts:88
  - detail: `wantedLocal = guess` is an intermediate variable used once; compare against `guess` directly.
  - evidence: (none)
- [quality] Awkward tuple cast in parseDatetimeLocal
  - location: src/time.ts:111
  - detail: Mapping to Number then casting to a six-element tuple is noisy. Destructure m[1]..m[6] with explicit Number() calls, as parseDateOnly does.
  - evidence: (none)
- [tests] datePresetRange not tested across a DST transition day
  - location: test/time.test.ts:200
  - detail: All datePresetRange cases use ranges whose boundaries share the same offset or the transition lies outside the range. Add a case for 'today' on 2026-03-08 or 2026-11-01 in America/New_York (a 23h or 25h range) to show the end boundary is computed per date, not start plus 24h.
  - evidence: (none)
- [tests] Redundant duplicate toThrow assertions
  - location: test/time.test.ts:29
  - detail: The exact-message assertion already implies the regex assertion directly below it. Keep the exact-message one (or the regex, to match the DoD wording) and drop the other.
  - evidence: (none)
- [tests] Invalid-input loops could be it.each
  - location: test/time.test.ts:105
  - detail: The for-loops over bad inputs stop at the first failure; the message does name the input, so this is acceptable. it.each would report all failing inputs at once.
  - evidence: (none)

