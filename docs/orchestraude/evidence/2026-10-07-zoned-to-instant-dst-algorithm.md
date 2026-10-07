---
id: 2026-10-07-zoned-to-instant-dst-algorithm
question: Does the zonedToInstant algorithm in support.md give the stated DST outcomes (gap → later valid instant, overlap → first occurrence), and does src/time.ts?
source: node v24.21.0 Intl (scratch simulation of the support.md text); src/time.ts and test/time.test.ts run with vitest 5.0.3 under the default TZ and TZ=Pacific/Auckland
fetched: 2026-10-07
expires: 2027-01-05
---
Learned:
- The previous support.md text (guess = parts as UTC; offset1 = offset(guess); t = guess - offset1; result = guess - offset(t)) gives:
  New York gap 2026-03-08 02:30 → 06:30Z (01:30 EST, earlier than the gap; expected 07:30Z);
  Berlin overlap 2026-10-25 02:30 → 01:30Z (second occurrence; expected 00:30Z).
  It matches the expected result only by coincidence for the Berlin gap (01:30Z) and the New York overlap (05:30Z).
- src/time.ts builds candidates guess - offset(guess - 1 day) and guess - offset(guess + 1 day), keeps those whose zonedParts round-trip to the requested wall time, returns min(valid), or max(candidates) when none round-trips.
- test/time.test.ts asserts all four cases (NY gap 07:30Z, NY overlap 05:30Z, Berlin gap 01:30Z, Berlin overlap 00:30Z); 29/29 tests pass under both process time zones.

Not confirmed:
- Behavior for zones with two transitions within ±1 day of the requested time, or with non-hour offset changes (e.g. Australia/Lord_Howe 30-minute DST); not tested.
