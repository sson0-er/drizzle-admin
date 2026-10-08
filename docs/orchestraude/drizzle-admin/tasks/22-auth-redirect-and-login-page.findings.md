# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [quality] Doc comment has a doubled word and understates the `//` rule
  - location: src/auth/redirect.ts:17
  - detail: The line reads 'and and no `//` at the start'. It also omits that the normalized pathname is rejected when it contains `//` (the check after the prefix test). Fix the typo and mention the normalized-path rule so the comment matches the code.
  - evidence: (none)
- [spec] Duplicated word in the safeNext doc comment
  - location: src/auth/redirect.ts:17
  - detail: The comment reads 'no control character, whitespace or backslash, and and no `//` at the start'. Remove the extra 'and'. The comment could also note that `//` inside the normalized path is rejected after parsing (auth.md step 4), since the rule list no longer says so.
  - evidence: (none)

