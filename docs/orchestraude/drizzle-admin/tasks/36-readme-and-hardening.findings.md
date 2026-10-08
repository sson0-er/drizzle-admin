# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] Template literal without interpolation in test table
  - location: test/errors.test.ts:115
  - detail: The expected value `other DbError -` is written as a template literal with no interpolation; use a plain string like the neighbouring rows (Biome's noUnusedTemplateLiterals may flag it).
  - evidence: (none)
- [spec] External-mode wording slightly over-generalizes
  - location: README.md:232
  - detail: The new sentence says that for an anonymous user 'every request, including /login/ and /logout/, is redirected'. The static stylesheet route (`/static/admin.css`) is registered before authGuard and is served without a redirect. Also, 'for a logged-in user /login/ and /logout/ return 404' holds for GET, but a POST to /logout/ without a valid `_csrf` gets 403 from the token check before it can reach the 404. Both are edge cases. Optionally say 'every page request' and 'GET /login/ and /logout/ ... return 404', or leave it as is.
  - evidence: (none)
- [tests] Removed README phrases are not pinned by a test
  - location: test/readme.test.ts
  - detail: The DoD says README must no longer contain 'filled with the current value', 'clears the session', 'Every request passes through an Origin check' or 'http://localhost:3000'. Only the localhost removal is implied (the replacement URL is asserted). An it.each of absent phrases would stop the stale claims coming back. The task did not require it, so this is optional.
  - evidence: (none)
- [tests] No boundary case for a long name in describeForLog
  - location: test/errors.test.ts:110
  - detail: The 64/65 length boundary is tested only for code. The same regex applies to name, so a 65-character name row (expected 'unique - 23505') would cover the name path too.
  - evidence: (none)

