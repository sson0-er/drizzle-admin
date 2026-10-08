# Review findings

high: 0, medium: 0, low: 9

## high


## medium


## low

- [quality] Whole-README key tests are subsumed by the section-scoped test
  - location: test/readme.test.ts:76
  - detail: The three it.each blocks check that each key appears anywhere in the README. The later section-scoped test already checks the same keys inside their reference sections, which is stricter. Fold the per-key it.each into that test (or drop the weaker ones) and remove the `documents` helper.
  - evidence: (none)
- [security] Origin check scope is overstated
  - location: README.md:245
  - detail: The README says 'Every request passes through an Origin check ... Otherwise it gets a 403 page.' Hono's csrf middleware only checks unsafe methods whose Content-Type is form-like (application/x-www-form-urlencoded, multipart/form-data, text/plain or missing). GET/HEAD/OPTIONS and e.g. application/json POSTs skip it. Such POSTs still fail the _csrf token check, so protection holds, but the README should describe the real scope, e.g. 'Every form POST (urlencoded, multipart or text/plain) is checked ...'. The same applies to the 'non-browser clients posting to the internal URL get 403' sentence at README.md:276. Those clients do get 403, but from the token check when the content type is not form-like.
  - evidence: (none)
- [security] Logout does not revoke the stateless session cookie
  - location: README.md:228
  - detail: The README says logout 'clears the session'. logoutHandler only deletes the cookie in the browser. The signed session is stateless, so a copied da_session cookie stays valid until sessionMaxAgeSec expires or the secret changes. To give deployers an accurate threat model, state this (for example in Known limitations): 'logout deletes the cookie but does not revoke it server-side; rotate secret to invalidate all sessions'.
  - evidence: (none)
- [security] Quick start compares passwords with plain ===
  - location: README.md:56
  - detail: The copy-paste quick start checks the password with `password === process.env.ADMIN_PASSWORD`. That is a plaintext, non-constant-time comparison, and the login has no rate limiting. Add a comment that real deployments should verify a stored password hash (bcrypt, argon2 or scrypt) or compare in constant time, so the snippet is not copied into production as is.
  - evidence: (none)
- [spec] FK choice ordering described as the referenced model's default ordering, but src sorts by primary key ascending when ordering is unset
  - location: README.md:288
  - detail: The Behavior notes say FK filter choices are 'the first 200 referenced rows in the referenced model's default ordering', and the Model options table defines the default `ordering` as 'primary key descending'. src/routes/list.ts:91-95 (and src/routes/form.ts:62 for FK selects) passes `ref.ordering`, which is `[]` when the referenced model sets no `ordering`. buildOrderBy (src/data/query.ts:86) then sorts by primary key ascending, so with more than 200 rows a different set of rows is offered than the README implies. The README repeats decision 013 item 7, so src is what deviates from the design; that is outside this task (src/** is Do-not-touch). Either reword the README to say 'the referenced model's `ordering`, or primary key ascending when unset', or route the src deviation to a follow-up task and leave the README as is.
  - evidence: (none)
- [spec] Origin check described as applying to every request
  - location: README.md:250
  - detail: The README says 'Every request passes through an Origin check ... a request passes if the browser sends `Sec-Fetch-Site: same-origin` or the `Origin` header equals ... Otherwise it gets a 403 page.' Hono's `csrf()` (src/auth/csrf.ts:10) only checks requests that are not GET/HEAD and have a form-style content type (node_modules/hono/dist/middleware/csrf/index.js isRequestedByFormElementRe). GET requests without an Origin header are not rejected. Suggested wording: 'Every form POST passes through an Origin check ...'.
  - evidence: (none)
- [spec] External mode: /login/ and /logout/ return 404 only for authenticated requests
  - location: README.md:229
  - detail: In external mode the routes are not registered (src/routes/index.ts:75-78), but authGuard (src/routes/middleware.ts:60-87) runs first. An anonymous request to `/login/` is therefore redirected to `loginUrl`, or gets 401 when `loginUrl` is not set, rather than a 404. Suggested wording: 'have no login or logout route of their own (for a logged-in user they return 404)'.
  - evidence: (none)
- [tests] Per-key it.each tests are subsumed by the in-section test
  - location: test/readme.test.ts:90
  - detail: The three it.each blocks check that the key appears anywhere in the README. The later test 'documents each ... inside its reference section' asserts the stronger condition for the same keys, so the weaker checks cannot fail on their own. Keep one parameterized test that scopes the check to the reference section. That also gives per-key failure names.
  - evidence: (none)
- [tests] Key check is a substring match and does not verify the default
  - location: test/readme.test.ts:55
  - detail: `db` or `fields` in backticks matches any mention, such as prose, rather than a table row for the option. The DoD asks for each option 'by name with its default', and no test checks for a default. Match a table row (/^\|\s*`key`\s*\|/m) and optionally require a non-empty default cell.
  - evidence: (none)

