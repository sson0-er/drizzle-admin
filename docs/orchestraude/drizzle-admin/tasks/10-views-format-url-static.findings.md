# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] stringify helper is redundant
  - location: src/views/format.ts:11
  - detail: String(value) already returns a string unchanged, so stringify() can be replaced by String(value) and removed.
  - evidence: (none)
- [spec] design ambiguity: truncation scope for JSON cells
  - location: src/views/format.ts:37
  - detail: views.md says 'Default-formatted strings longer than 100 chars -> first 100 + …' but does not say which rules produce 'default-formatted strings'. The implementation truncates rule 7 (JSON.stringify output) and rule 10 (String(value)). It does not truncate formatter output, fkLabel, dates or numbers. That reading is reasonable, but a long JSON value in a list cell is cut mid-token, and no test covers JSON truncation. Ask the user to confirm whether JSON text should be truncated. If so, consider adding a test for it.
  - evidence: (none)
- [tests] Truncation applied to json output is untested
  - location: test/format.test.ts:93
  - detail: format.ts truncates JSON text (rule 7) as well as default strings, but the truncation tests only use plain strings. Add a case with a long json value expecting 100 chars plus the ellipsis.
  - evidence: (none)
- [tests] formatValue test duplicates formatCell rule cases
  - location: test/format.test.ts:114
  - detail: The 'applies rules 2 and 4-10' test repeats assertions already made through formatCell and adds no new branch. It could be removed or folded in.
  - evidence: (none)

