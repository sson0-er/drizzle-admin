---
id: 2026-10-08-safenext-decoded-path
question: For login `next` validation, how do WHATWG URL parsing, decodeURIComponent and Hono's `c.req.path` treat encoded dot segments, `%2F`, spaces and malformed escapes?
source: node 24.21.0 (`new URL`, `decodeURIComponent`) and hono 4.13.13 (`app.request`, `c.req.path`), run in the project 2026-10-08; src/auth/redirect.ts and task 22 findings (working tree, uncommitted)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `new URL(next, "http://x.invalid").pathname` resolves `.`/`..` and `%2e`/`%2E` dot segments (`/admin/%2e%2e/x` → `/x`, `/admin/./x` → `/admin/x`, `/admin/a/../b/` → `/admin/b/`, `/admin/%2e/x` → `/admin/x`), but not segments joined by an encoded slash: `/admin/..%2Fx` and `/admin/%2e%2e%2fx` stay as they are, so they pass a raw prefix check while `decodeURIComponent` gives `/admin/../x`.
- `%20` and `%2F%2F` stay encoded in the URL pathname (`/admin/kv/a%20b/change/`, `/admin/a%2F%2Fb/`).
- `decodeURIComponent` throws `URIError` on a malformed escape (e.g. `%E0%A4%A`).
- Hono `c.req.path` decodes `%20` to a space, `%09` to a tab and `%5C` to `\`, but keeps `%2F`/`%2f` encoded (`/admin/..%2Fx` → `/admin/..%2Fx`, `/admin/%2e%2e%2fx` → `/admin/..%2fx`); `new URL(c.req.url).pathname` keeps `%20`.
- Task 22's first `safeNext` rejected decoded whitespace (so `/admin/kv/a%20b/change/` fell back to the dashboard) and returned `/admin/..%2Fx` unchanged.

Not confirmed:
- How every reverse proxy or router normalizes a decoded `..` produced from `%2F` (the reason for rejecting it is defensive, not a reproduced exploit).
- Browser behaviour was not tested; only Node's WHATWG URL implementation.
