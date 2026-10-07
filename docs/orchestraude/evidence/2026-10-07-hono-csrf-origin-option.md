---
id: 2026-10-07-hono-csrf-origin-option
question: Can hono/csrf be configured to compare Origin with a fixed public origin (for AdminConfig.publicOrigin)?
source: https://hono.dev/docs/middleware/builtin/csrf
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: `csrf()` accepts `origin: string | string[] | (origin, c) => boolean` (default: the request URL origin) and `secFetchSite: string | string[] | function` (default: `same-origin`). When both are configured the request passes if EITHER check passes (OR). Only unsafe methods (not GET/HEAD/OPTIONS) with form-sendable content types (urlencoded, multipart, text/plain) are checked.
So `csrf({ origin: "<public origin>" })` replaces the request-URL-derived comparison while keeping the Sec-Fetch-Site path.
Not confirmed: whether the string comparison is exact equality (assumed from the docs wording "permitted origins"; earlier source reading of hono 4.13.13 in 2026-10-07-hono-csrf-and-jsx showed an equality check for the default). The docs page does not name the hono version it describes.
