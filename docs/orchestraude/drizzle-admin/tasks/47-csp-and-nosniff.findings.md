# Review findings

high: 0, medium: 0, low: 1

## high


## medium


## low

- [tests] Redundant not.toContain after exact CSP match
  - location: test/headers.test.ts:105
  - detail: The external-mode test asserts the CSP equals EXTERNAL_CSP and then that it does not contain form-action. The exact match already implies the latter (CLAUDE.md: no assertions another assertion in the same test fully implies). Drop the not.toContain line.
  - evidence: (none)

