---
id: 2026-10-08-trailing-slash-control-char-bypass
question: Does the decision 029 denylist (404 when rest starts with "//" or contains "\") still allow off-site redirects through control characters, and how do Hono routes and browsers treat such paths?
source: scratch scripts via `npx tsx` against hono 4.13.13 (bare `Hono` apps, and `admin.fetch` of the working tree 2026-10-08 with basePath "/" and "/admin"); Node 24.21.0 WHATWG `URL`
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- The old denylist rule on a bare Hono app with prefix "": `GET /%09/evil.example` → `301 Location: /\t/evil.example/` (Hono percent-decodes `%09` into a literal tab in `c.req.path`); `GET /%20/evil.example` → `301 Location: / /evil.example/`.
- WHATWG URL parsing strips ASCII tab, LF and CR: `new URL("/\t/evil.example/", "https://a.example").href` and the same with `\n` are `https://evil.example/`. So the tab Location is an off-site redirect.
- Hono's `*` / `/*` patterns do not match a decoded path containing LF or CR (also U+2028): no route and no `app.use("*")` middleware runs. Standalone, the app's `notFound` handler answers; when the app is mounted with `parent.route("/admin", sub)`, the sub-app's `notFound` is ignored and the parent's default plain-text `404 Not Found` is returned. `%7F` and `%00` paths do match `/*`.
- The working tree's allowlist catch-all (src/routes/index.ts, already changed when probed) gives, for basePath "/" and "/admin": `/%09/evil.example`, `///evil.example`, `/%7F/evil.example`, `/a//b` → 404 HTML page, no Location; `/%0a/evil.example`, `/%0d/evil.example` → 404 `text/plain` "404 Not Found" without Location and without X-Frame-Options (not routed, see above); `/users?a=1` → 301 `/users/?a=1` (or `/admin/users/?a=1`); `/%2F%2Fevil.example` → 301 with the encoding kept; `GET /` with basePath "/" → 200.

Not confirmed:
- Behaviour of every browser (only Node's WHATWG URL implementation was run).
- The cause inside Hono's RegExpRouter (assumed: the generated regex uses `.` without the `s` flag, so line terminators do not match).
