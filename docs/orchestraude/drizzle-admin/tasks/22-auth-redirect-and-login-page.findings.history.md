## Round 1

# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] Redundant checks in safeNext
  - location: src/auth/redirect.ts:23
  - detail: `next[1] === "\\"` is already covered by isPlain (backslash rejected) and `url.pathname.includes("//")` is implied by `decoded.includes("//")` since decoding never removes a raw '//'. Drop both to shorten the function.
  - evidence: (none)
- [security] Percent-encoded slash lets the decoded path escape the prefix
  - location: src/auth/redirect.ts:47
  - detail: safeNext("/admin/..%2Fx", "/admin") and safeNext("/admin/%2e%2e%2fx", "/admin") are returned unchanged. The URL parser does not treat `..%2Fx` as a dot segment, and the decoded form `/admin/../x` passes the decoded checks, which only look for `//`, control characters, whitespace and backslash. The origin cannot change, so this is not an open redirect. However, the comment says the decoded form must be as harmless as the raw one, and a proxy or router that decodes and then normalizes would resolve the path outside the prefix. If that guarantee is intended, also reject a decoded path that contains `%2F` or `/../` or `/./`, or check that the decoded path still starts with `${prefix}/` after normalization.
  - evidence: (none)
- [spec] design ambiguity: safeNext adds decoded-path and '//' rejections not listed in auth.md
  - location: src/auth/redirect.ts:40-49
  - detail: auth.md#redirectts lists the conditions under which safeNext returns next: leading '/', no '/' or '\' as the second character, no '\', control character or whitespace in the raw string, same origin, and pathname under `${prefix}/`. The implementation adds two more checks. It rejects when the percent-decoded pathname contains a control character, whitespace or '\', or when the percent decoding is malformed. It also rejects any '//' in the raw or decoded pathname. The report cites decision 029, but that decision covers the catch-all redirect and states that percent-encoded `%2F%2F` 'stays encoded in the Location' and keeps working. Practical effect: after login, a user who tried to open a legitimate URL whose path has an encoded space, tab or slash pair, such as a text-PK change page `/admin/kv/a%20b/change/` (kv has a text PK), lands on the dashboard instead. The design does not say whether next is judged in raw or decoded form, so ask the user. Either amend auth.md to adopt the stricter rule, or drop the decoded and '//' checks to match the listed conditions exactly. The DoD rejection cases pass either way.
  - evidence: (none)
- [tests] Empty-prefix cases are split between two styles
  - location: test/redirect.test.ts:21
  - detail: The empty-prefix rejections sit in a hand-written test and in the 'accepts any single-slash path for an empty prefix' case, while the /admin rejections use it.each. A second it.each for the empty prefix would be more uniform. Preference only.
  - evidence: (none)


### Implementer response after round 1 (user decision on safeNext strictness; decision 032)

Added src/auth/redirect.ts (safeNext, loginRedirectUrl, externalLoginUrl) and src/views/login.tsx (LoginPage). safeNext rule (per the user's round 1 decision): the raw next must start with `/`, contain no control character, whitespace or backslash, and no `//` in its path (query and fragment excluded); it must be same-origin and under `${prefix}/`; the result is the normalized pathname + search. The percent-decoded path must be valid, contain no control character or backslash and no `.` or `..` segment, so `..%2Fx`, `%2e%2e%2fx`, `a%2F..%2Fb` and `.%2Fx` are rejected. Decoded whitespace (`/admin/kv/a%20b/change/`) and encoded `%2F` / `%2F%2F` are accepted unchanged. A literal `/admin/./x` is normalized to `/admin/x`, like `/admin/a/../b/` -> `/admin/b/` (confirmed by the user). The redundant checks from the quality finding were removed, the code comment states the rule, and empty-prefix rejections use it.each. LoginPage renders form#login-form (POST ${prefix}/login/), hidden _csrf and next, the username input with its value, a password input with no value attribute, and p.errornote only when error is given. Tests are in test/redirect.test.ts and the LoginPage block in test/views.test.ts. scripts/verify.sh passes.

## Round 2

# Review findings

high: 0, medium: 1, low: 1

## high


## medium

- [spec] redirect.test.ts lacks several safeNext cases that test-strategy.md lists
  - location: test/redirect.test.ts:4-72
  - detail: The amended test-strategy.md auth row (decision 032) names cases that have no test. Accept: `/admin/x/?q=//evil` ('//' in the query is allowed; the implementation handles this explicitly with `next.split(/[?#]/, 1)`, and no test pins it down), and `/admin/%2e/x` -> `/admin/x`. Reject: `/admin/%zz`, `/admin/a%7Fb/`, `/admin/a b/`. Empty prefix: the row asks for the same cases with `/admin` removed, including `/other/` -> `/other/`, `/admin/../x` -> `/x` and `/admin/%2e%2e/x` -> `/x`. Only four empty-prefix rejections are tested. A probe shows the current code already returns the expected value for all of them, so only tests are missing. Add these cases, for example as a second accept/reject it.each run with prefix "".
  - evidence: (none)

## low

- [spec] Raw '//' check runs on the unparsed next, not on url.pathname as auth.md step 4 states
  - location: src/auth/redirect.ts:238
  - detail: auth.md step 4 and decision 032 (b) define the check as `raw = url.pathname` contains no `//`. The code instead checks `next.split(/[?#]/, 1)[0]` before parsing. I found no input that the design rejects and the code accepts. The code is stricter in edge cases: `/admin/a//../b` normalizes to `/admin/a/b`, which passes step 4 by the design, but the code falls back to `/admin/`. This has no realistic impact. Either check `url.pathname.includes("//")` after parsing (the raw-string check then only needs to cover the second-character rule of step 1), or leave the code as it is.
  - evidence: (none)


### Implementer response after round 2

Added src/auth/redirect.ts (safeNext, loginRedirectUrl, externalLoginUrl) and src/views/login.tsx (LoginPage). safeNext follows auth.md steps 1-7 / decision 032: raw next starts with `/` and not `//`, has no control character, whitespace or backslash; same origin, normalized pathname under `${prefix}/`; the normalized pathname has no `//` (encoded %2F%2F allowed, `//` in the query allowed); percent-decoding must succeed; the decoded path has no control character or backslash and no `.` / `..` segment; decoded whitespace is allowed. Returns pathname + search (still encoded). LoginPage renders form#login-form (POST ${prefix}/login/), hidden _csrf and next, username with value, password with no value attribute, p.errornote only with error. Review round fixes: [medium, spec] test/redirect.test.ts now runs a shared case table for both prefix `/admin` and `""` with the accept cases `/`, list URL, `a%20b`, `%2F`, `%2F%2F`, `?q=//evil`, fragment drop, `./x`, `a/../b/`, `%2e/x`, and the reject cases incl. `/admin/%zz`, `a%7Fb`, `a b`, malformed escape, encoded control/backslash, encoded dot segments; a boundary block covers `/other/`, `/admin/../x`, `/admin/%2e%2e/x` (rejected for /admin; `/other/`, `/x`, `/x` for the empty prefix). [low, spec] the `//` check now runs on the normalized `url.pathname` after parsing, as in auth.md step 4; the raw string only keeps the leading `//` rule. [low, quality/tests from round 1] redundant checks removed and empty-prefix cases unified earlier. No finding was left unchanged. scripts/verify.sh passes.

