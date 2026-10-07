# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [spec] Newly added test-strategy trailing-slash cases are only partly tested
  - location: test/pages.test.ts:124
  - detail: test-strategy.md was amended in this round (decision 029). It now also lists these cases: `GET /a%20b` and `GET /admin/a%20b` -> 404 HTML page without Location (whitespace is outside the allowlist); `GET /admin///evil.example` -> 404; `GET /admin/users?a=1` -> 301 `/admin/users/?a=1`; `GET /admin?a=1` -> 301 `/admin/?a=1`; and, with basePath "/", `GET /authors?x=1` -> 301 `/authors/?x=1`, which the previous test covered and this round replaced with `/users?a=1`. The strategy also says the non-LF/CR cases return the layout 404 HTML page (`Content-Type: text/html`), but the shared it.each asserts only status and the missing Location. I probed the current code and it behaves correctly for all of these cases. The task DoD does not list them. Fix: add the `%20` paths and `/admin///evil.example` to the it.each lists, add the redirect cases, and for the non-LF/CR paths assert the layout `h1` or the `text/html` Content-Type.
  - evidence: (none)
- [tests] Allowlist's whitespace and 0x7f branches are not exercised
  - location: test/pages.test.ts:126
  - detail: SAFE_REST also rejects \s and \x7f, but no case uses %20, %7f or a trailing-slash path such as /admin/users/ that was previously 404ed by the endsWith check. Adding '/%20/evil.example' and '/%7f/evil.example' to the it.each lists would pin the whole allowlist.
  - evidence: (none)

