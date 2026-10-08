# Review findings

high: 0, medium: 0, low: 3

## high


## medium


## low

- [spec] Selection-cap tests filter flashes by the warning class instead of pinning exactly one flash
  - location: test/actions.test.ts:206
  - detail: The task asks that the next list GET shows exactly one flash, level warning. `flashes(client, res, "warning")` returns only `li.warning` entries, so an extra flash of another level would go unnoticed. The code path can only produce one flash, and this matches the existing pattern in the file. Optional fix: call `flashes(client, res)` without a class and compare it to `[messages.tooManySelected(500)]` alongside the warning-filtered check.
  - evidence: (none)
- [tests] Search normalization rows omit trim and code-point cut
  - location: test/list.test.ts:167
  - detail: The implementation also trims and counts code points (so a surrogate pair is not split), but no row pins either behavior. Add rows such as '%20%20a%20' -> 'a' and 200 x plus an astral character (e.g. '%F0%9F%98%80'.repeat(201)) -> 200 emoji. Optional, since the task DoD lists only the two existing rows.
  - evidence: (none)
- [tests] Search tests assert only the echoed value, not the searched value
  - location: test/list.test.ts:167
  - detail: A regression that echoes the normalized q but passes the raw q to repo.list would still pass on sqlite, though PG would 500 on NUL. Optionally assert the result rows too, e.g. '?q=a%00b' gives the same rows as '?q=ab'.
  - evidence: (none)

