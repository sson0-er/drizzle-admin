# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] Duplicated cookie option construction
  - location: src/auth/flash.ts:34
  - detail: writeSession and addFlash both build the same httpOnly/sameSite/path/secure option set, and `o.prefix || "/"` is repeated four times across session.ts and flash.ts. A small shared helper (e.g. cookiePath(prefix)) would remove the repetition.
  - evidence: (none)
- [spec] design ambiguity: writeSession serializes the user object as passed, including extra properties
  - location: src/auth/session.ts:76
  - detail: writeSession limits the top-level keys to u/csrf/iat but writes `u: s.u` verbatim. A verifyCredentials implementation that returns a richer object (e.g. with email or a hash) structurally satisfies AdminUser, and those extra fields would land in the signed but unencrypted, client-readable cookie. readSession already narrows u to {id, name}. The design does not say whether u should be narrowed on write; if it should, write `u: s.u && { id: s.u.id, name: s.u.name }`.
  - evidence: (none)
- [spec] design ambiguity: addFlash emits one Set-Cookie header per call
  - location: src/auth/flash.ts:31
  - detail: Each addFlash call appends another da_flash Set-Cookie, and the last one holds the accumulated messages. Browsers keep the last header, so the DoD behavior is met. The design says only that addFlash 'appends to messages already set in this response' and does not say whether the response should carry a single header. Replacing the earlier header is optional.
  - evidence: (none)
- [tests] Flash tampered-cookie test does not assert the tamper took effect
  - location: test/flash.test.ts:78
  - detail: The session tamper test asserts `expect(tampered).not.toBe(cookie)`, but the flash one does not. If the replace ever matched nothing, the test would silently check a valid cookie and fail only by accident. Add the same guard.
  - evidence: (none)
- [tests] Direct isSecure test duplicates the cookie-level table
  - location: test/session.test.ts:200
  - detail: The isSecure describe repeats the same four rows already covered through the Set-Cookie tests, using a cast fake context. It can be dropped or folded into the parameterized table.
  - evidence: (none)
- [tests] Invalid flash cookie deletion is not asserted
  - location: test/flash.test.ts:70
  - detail: consumeFlash deliberately deletes the cookie even when it is invalid (comment in the implementation), but only the valid-cookie case asserts the deletion header. Add an assertion on the invalid-shape cases.
  - evidence: (none)

