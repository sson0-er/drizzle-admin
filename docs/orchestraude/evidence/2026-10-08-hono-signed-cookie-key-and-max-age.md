---
id: 2026-10-08-hono-signed-cookie-key-and-max-age
question: For decision 042, can hono's signed-cookie helpers take a derived binary key, what exactly is signed, and what does the serializer do with Max-Age above 400 days?
source: node_modules/hono 4.13.13 (dist/utils/cookie.js, dist/types/helper/cookie/index.d.ts), read locally
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `getSignedCookie(c, secret, key)` and `setSignedCookie(c, name, value, secret, opt)` type `secret` as `string | BufferSource`. A string is UTF-8 encoded; a BufferSource is passed to `crypto.subtle.importKey("raw", ...)` as is (HMAC SHA-256).
- `makeSignature(value, secret)` signs the cookie value only; the cookie name, path and any instance data are not part of the MAC. A verifying instance with the same secret accepts any value signed by another.
- The value format is `<value>.<base64 signature>`; a signature that is not 44 chars ending in `=` is skipped, a wrong one yields `false`.
- `_serialize` throws `Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.` when `maxAge > 34560000`.
Not confirmed: behavior of other hono versions (peer range `^4.13.13`).
