# 025: zonedToInstant uses two candidate offsets with a round-trip check

- Date: 2026-10-07
- Status: accepted

## Context
`interfaces/support.md` specified `zonedToInstant` as a single-pass two-offset correction (`offset1 = offset(guess); t = guess - offset1; result = guess - offset(t)`), with the stated outcomes "DST gap → the later valid instant; overlap → the first occurrence". During task 02-support-time the implementer found that the algorithm contradicts these outcomes. It returns the earlier instant in the New York gap and the second occurrence in the Berlin overlap (evidence: 2026-10-07-zoned-to-instant-dst-algorithm). The stated outcomes are kept, so the algorithm text had to change. Code is unchanged: `src/time.ts` already implements the decision below.

## Decision
Use these definitions. `guess` is the wall-clock parts read as UTC, and `offset(x)` is the zone's UTC offset at instant `x`, derived from `zonedParts`. Then:
1. candidates = distinct `{ guess - offset(guess - 1 day), guess - offset(guess + 1 day) }`.
2. valid = the candidates whose `zonedParts`, read as UTC, equal `guess`.
3. result = `min(valid)` if any are valid (overlap → first occurrence). Otherwise it is `max(candidates)` (gap → the later valid instant, i.e. the wall time shifted forward by the gap length).

`interfaces/support.md` now describes this algorithm with the four DST examples. `test-strategy.md` pins those four cases.

## Alternatives considered
- Keep the single-pass correction and change the stated outcomes to match it: rejected. In the tested zones its outcome flips between west and east of UTC. In a gap it gives the earlier instant in New York but the later one in Berlin. In an overlap it gives the first occurrence in New York but the second in Berlin (evidence: 2026-10-07-zoned-to-instant-dst-algorithm). No single stated rule describes it.
- Keep the single-pass correction and add a gap/overlap fix-up step: possible, but it means more special cases than the candidate method, and nothing implements or tests it (unverified that it would be simpler).
- Use `Temporal` (`ZonedDateTime` with `disambiguation: "compatible"`), which is meant to give these outcomes (unverified): not chosen. support.md limits `time.ts` to `Intl`, and `Temporal` availability on the supported Node versions was not checked (unverified).

## Rationale
The candidate/round-trip method gives all four expected results (New York and Berlin, gap and overlap). It does not depend on the process time zone, because `test/time.test.ts` passes under both the default TZ and `Pacific/Auckland` (evidence: 2026-10-07-zoned-to-instant-dst-algorithm). It is already implemented and reviewed in task 02-support-time, so the design follows the code and the code does not change.

## Consequences
- `interfaces/support.md` (the `zonedToInstant` comment) and `test-strategy.md` (support row) are updated. Tasks that read support.md now see the correct algorithm.
- The ±1 day window assumes at most one offset transition within a day of the requested time. Zones that break this were not tested (unverified).
