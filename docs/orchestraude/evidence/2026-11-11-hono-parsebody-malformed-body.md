---
id: 2026-11-11-hono-parsebody-malformed-body
question: For decision 054, what does hono's `c.req.parseBody` do with a POST body it cannot parse, and what did the admin answer?
source: node_modules/hono 4.13.13 (dist/utils/body.js), read locally; requests sent to the example admin through `admin.fetch` on Node 24.21.0 (before the change)
fetched: 2026-11-11
expires: 2027-02-09
---
Learned:
- `parseBody` parses only `multipart/form-data` and `application/x-www-form-urlencoded` bodies (through `FormData`); any other content type resolves to `{}`.
- A `multipart/form-data` body that is not valid multipart (no boundary parameter, or a body that does not match it) makes the returned promise reject with `TypeError: Failed to parse body as FormData.`
- Before the change, such a POST with a same-origin `Origin` header got a 500 page and one `console.error` line from `onError`. It needed no login on `/admin/login/` (builtin mode) and `/admin/_lang/`; on other paths an anonymous request is redirected to the login first.
- Without an `Origin` (or `Sec-Fetch-Site`) header the Origin check answers 403 before the body is read.
Not confirmed: other runtimes than Node (the error comes from the runtime's `FormData` parser); other hono versions in the peer range `^4.13.13`.
