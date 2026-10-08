# Review findings

high: 0, medium: 0, low: 3

## high


## medium


## low

- [quality] Inconsistent braces in the new password checks
  - location: src/admin.ts:207
  - detail: The primary-key check is a braceless multi-line if while the two following checks use braces. Use braces on all three for a uniform shape.
  - evidence: (none)
- [quality] Leading union carries a rule tag for cases with no payload
  - location: src/views/format.ts:53
  - detail: The Leading type plus a switch in formatCell is heavier than the four-condition chain it replaces, though it does satisfy the single-source requirement. Acceptable as is; a plain function returning the first matching rule name would be simpler only if the formatter/fkLabel narrowing were handled with a commented non-null assertion.
  - evidence: (none)
- [spec] Password checks run inside the allowedWidgets loop, not after it
  - location: src/admin.ts:206
  - detail: admin.md step 5 says 'Then, for every widgets[key] === "password"' after the allowedWidgets check, and the task note says to run the password checks after the existing allowedWidgets loop. The implementation instead runs them per entry inside the same loop. The only observable difference is which error is thrown when a config has two errors. For example, with widgets { key: "password", name: "checkbox" } the primary-key error is thrown before the not-allowed-widget error for name, while the design order would throw the not-allowed error first. Every single-error case behaves the same. To match the design literally, move the three password checks into a second `for (const [key, widget] of widgetEntries)` loop after the allowedWidgets loop.
  - evidence: (none)

