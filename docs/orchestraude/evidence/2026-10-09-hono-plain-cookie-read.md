---
id: 2026-10-09-hono-plain-cookie-read
question: For decision 050, how does hono read and write an unsigned cookie (missing header, malformed value, duplicates), and does it ever throw on read?
source: node_modules/hono 4.13.13 (dist/helper/cookie/index.js, dist/utils/cookie.js, dist/utils/url.js), read locally
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `getCookie(c, name)` returns `undefined` when the request has no `Cookie` header or no pair with that name; otherwise a string.
- `parse` skips pairs whose value fails `/^[ !#-:<-[\]-~]*$/`, strips one pair of surrounding double quotes, and with a name argument stops at the first valid pair of that name (the first occurrence wins).
- Values are percent-decoded with `tryDecodeURIComponent`, which catches `URIError` and leaves malformed escapes as written, so reading never throws.
- `setCookie(c, name, value, opt)` appends one `Set-Cookie` header; `deleteCookie` reuses it with `maxAge: 0`. The serializer's 400-day `maxAge` limit (34560000 s) applies to every cookie (see also evidence 2026-10-08-hono-signed-cookie-key-and-max-age).
Not confirmed: behavior of other hono versions (peer range `^4.13.13`); the order in which browsers send two same-name cookies with different paths (only the first is read).
