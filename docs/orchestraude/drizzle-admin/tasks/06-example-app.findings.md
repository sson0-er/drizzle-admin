# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] Clamped age is computed at module load, not at seed call
  - location: example/seed.ts:47
  - detail: PUBLISH_AGES_DAYS calls new Date().getDate() when the module is imported, while the seed comment says dates are relative to the time of the call. In a long-lived process (or tests spanning midnight) the two can disagree. Compute the clamped age inside seed(), next to ago().
  - evidence: (none)
- [quality] Side-effecting counter inside Array.from mapper
  - location: example/seed.ts:74
  - detail: publishedCount++ mutates outer state inside the map callback, which is easy to misread. A simpler form is to derive the age index from i alone, e.g. Math.floor(i / 3) * 2 + ((i % 3) - 1), or to build the published list first. Optional.
  - evidence: (none)
- [spec] This-month clamp uses the date at module load, not at seed time
  - location: example/seed.ts:47
  - detail: PUBLISH_AGES_DAYS calls new Date().getDate() once, when the module is imported. seed() takes its own `now` when it is called. The task notes say seed dates come from new Date() at seed time. If a process imports seed.ts before midnight on the last day of a month and seeds after midnight, the clamped age (up to 12 days) can land in the previous month. This is unlikely for the demo. To fix it, compute the clamp inside seed() from the same `now`, e.g. Math.min(12, new Date(now).getDate() - 1).
  - evidence: (none)
- [tests] No test pins the seed date distribution that the round-1 fix corrected
  - location: test/example.test.ts:5
  - detail: The round-1 defect (no post published today, because the age index lined up with the draft pattern) slipped through because nothing asserts the seeded data. The only test builds the app and checks the redirect. Add a small test that runs seed() on an in-memory DB and asserts there is at least one published post with publishedAt today, one within the past 7 days, one earlier this month and one older. Also assert the counts (5 users, 60 posts, 8 tags).
  - evidence: (none)

