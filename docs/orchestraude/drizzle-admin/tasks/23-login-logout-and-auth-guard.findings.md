# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] Login route registration repeats the builtin check
  - location: src/routes/index.ts:75
  - detail: The authGuard login exemption in middleware.ts checks authMode === 'builtin' separately from the route registration here. Both are correct, but the two places must stay in sync; a short comment in the guard pointing to this registration would make that explicit.
  - evidence: (none)
- [quality] renderLogin re-vets next that the GET path may already have vetted
  - location: src/routes/login.ts:41
  - detail: renderLogin applies safeNext to every next, which is the right single choke point; the 'next ?? ""' at the GET call site is fine. Minor: the empty-string special case could live in a tiny helper if more callers appear. No change required.
  - evidence: (none)
- [spec] design ambiguity: HEAD handling in the auth guard
  - location: src/routes/middleware.ts:70
  - detail: routes.md exempts only `GET|POST /login/`, and says non-GET requests get `next = <prefix>/`. The guard also exempts HEAD on /login/ (sensible, since Hono serves HEAD through the GET route), but for every other path a logged-out HEAD counts as non-GET and gets `next=<prefix>/` instead of the requested path. Both readings are defensible, and HEAD has no user-visible effect. If the design should say anything, it could state that HEAD is treated like GET.
  - evidence: (none)
- [spec] Two pages.test.ts cases now always use sqlite inside describe.each(dialects)
  - location: test/pages.test.ts:30
  - detail: 'serves the dashboard with a session cookie' and 'rejects a POST without a session cookie' now build an external-auth admin on `dialects[0]` regardless of the `fixture` loop variable, so the pg iteration repeats the sqlite case. Passing `fixture` instead of `dialects[0]` would keep per-dialect coverage. The adaptation is listed in History and the assertions are unchanged.
  - evidence: (none)
- [tests] Session expiry test hardcodes the default max age
  - location: test/auth.test.ts:222
  - detail: The test uses the literal 28800 instead of deriving it from the admin config or a named constant. If the default changes, the control case still passes but the expiry case may fail for a reason unrelated to the age check. Use a named constant, or configure sessionMaxAgeSec explicitly in makeAdmin.
  - evidence: (none)
- [tests] Tampered cookie construction is hard to follow
  - location: test/auth.test.ts:180
  - detail: The test signs a forged payload, then decodes it, strips the signature and splices on the genuine signature. A helper such as swapPayload(genuineCookie, newPayload) with a short comment would make the failure cause clearer. The control that an untampered cookie works is covered elsewhere.
  - evidence: (none)

