# Review findings

high: 0, medium: 0, low: 8

## high


## medium


## low

- [quality] Redundant assertion before exact status
  - location: test/proxy.test.ts:92
  - detail: expect(res.status).not.toBe(403) is implied by the following expect(res.status).toBe(303); drop the first line.
  - evidence: (none)
- [quality] Flash cookie test duplicates the accepted-POST test
  - location: test/proxy.test.ts:63
  - detail: The flash test and 'accepts a POST from the public Origin' perform the same request and 303 assertion; the accept test could be merged into the flash test or assert something distinct.
  - evidence: (none)
- [quality] Example app setup repeated
  - location: test/example.test.ts:40
  - detail: createExampleApp with the same options and createClient wiring is repeated in both phase-5 tests; a small local helper would remove it.
  - evidence: (none)
- [security] 'leaves the data alone when delete is refused' cannot detect a bypass
  - location: test/auth.test.ts:478
  - detail: Author 1 owns seeded articles (authorId 1, FK enforced in both dialects), so a delete of author 1 always fails with a foreign-key error, and delete_selected without _confirm only renders the confirmation page. The row would survive even if the delete permission gate were bypassed, so this test adds nothing beyond the 403 assertions. The matrix's allowed control also POSTs a real delete of author 1, which only stays harmless because of that FK. Either target a row with no dependents (for example one inserted in the test) and send _confirm=1 for delete_selected, or drop the test.
  - evidence: (none)
- [security] XSS payload does not exercise attribute-context escaping
  - location: test/auth.test.ts:581
  - detail: The change page renders the name inside an input value attribute, but the payload '<script>alert(1)</script>' contains no quote, so escaping of '"' in attributes is not exercised. Adding a payload such as '"><script>alert(1)</script>' (or a second row with one) would cover attribute breakout as well. The DoD names only the current payload, so this is optional hardening.
  - evidence: (none)
- [spec] design ambiguity: Secure on the da_flash cookie is checked on a POST, not on a GET as the DoD and the test-strategy row require
  - location: test/proxy.test.ts:62
  - detail: DoD item 4 and the test-strategy.md 'Reverse proxy' row say 'GET Set-Cookie (session and flash) has Secure'. A GET never sets da_flash. It only deletes it, and that deletion (src/auth/flash.ts:46, deleteCookie with only `path`) has no Secure attribute. The session cookie's deletion (src/auth/session.ts:86) has the same gap. So a literal test of the DoD would fail, and the fix would be in src/auth/**, which this task must not touch. The implementer instead checks Secure on the da_flash set by a POST 303. Ask the user which they want: (a) the DoD means 'the cookie when it is set', and the POST check is accepted; or (b) deletion cookies should carry Secure too when publicOrigin is https, which needs a follow-up change in src/auth/flash.ts and session.ts plus a GET check here.
  - evidence: (none)
- [spec] The 'leaves the data alone when delete is refused' test passes even if the delete is not refused
  - location: test/auth.test.ts:479
  - detail: Author 1 is referenced by articles (fixture FK), so deleting it always fails with a foreign-key flash, whether or not the permission gate works. The 'allowed' control for POST /admin/authors/1/delete/ also returns 303 only because the FK blocks the delete. Later tests need author 1 to still exist, so they rely on the same FK. This test is not a DoD item, and the 403 assertions already cover the gate. To make it meaningful, target an author with no articles, or remove the test.
  - evidence: (none)
- [tests] Control requests in the 403 matrix mutate shared data
  - location: test/auth.test.ts:456
  - detail: The allowed-control request for delete POST and bulk delete_selected can really delete author 1 in the shared database. The later 'leaves the data alone when delete is refused' test and the change-page tests that GET /authors/1/change/ then depend on test order and on the control not deleting the row. If the control does delete it, the data-alone assertion fails or the test proves nothing. Delete a different row in the controls, or reseed per test. The change-POST 403 case also never checks that the row is unchanged.
  - evidence: (none)

