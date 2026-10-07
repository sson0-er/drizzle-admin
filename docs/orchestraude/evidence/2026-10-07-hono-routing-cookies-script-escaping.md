---
id: 2026-10-07-hono-routing-cookies-script-escaping
question: How do Hono sub-app mounting, trailing-slash paths, signed cookies and JSX <script> children behave?
source: scratch probes with hono 4.13.13 (app.route, app.request, hono/cookie, hono/jsx) on Node 24.21.0
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: with `root.route("/admin", sub)`, a sub route `"/"` (or `""`) matches `/admin` but NOT `/admin/`; `basePath("/admin")` + `"/"` behaves the same. Pattern `"/*"` matches `/admin`, `/admin/` and deeper paths; `c.req.path` is the full path, so the two can be told apart. `/:model/` matches `/admin/users/` but not `/admin/users`. When several registered routes match, the first registered handler that returns wins (a `/:model/` registered before `/view/` captured `/view/`).
hono/cookie exports getCookie, setCookie, deleteCookie, getSignedCookie, setSignedCookie, generateSignedCookie. setSignedCookie appends an HMAC-SHA256 signature (URL-encoded value + "." + base64 signature); getSignedCookie returns the value or `false` when tampered.
hono/jsx escapes children of <script> like any text: `"` -> `&quot;`, `<` -> `&lt;`, `&&` -> `&amp;&amp;`. An inline script must therefore avoid & < > " ' characters, or be served differently.
Unknown: whether `c.req.param()` percent-decodes values with reserved characters (not probed).
