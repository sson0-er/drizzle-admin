---
id: 2026-10-08-hono-head-cookie-body-node-server
question: For the low-findings decisions (L064, L072, body size, example bind), how do Hono 4.13.13 and @hono/node-server 2.1.3 treat HEAD requests, cookie deletion attributes, form body parsing and the listen address?
source: node_modules/hono 4.13.13 (dist/hono-base.js, dist/request.js, dist/helper/cookie/index.js, dist/utils/body.js), node_modules/@hono/node-server 2.1.3 (dist/index.mjs, dist/index.d.mts), a scratch script run with node 24; src/routes/middleware.ts (working tree)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- HEAD: `Hono#fetch` dispatches a HEAD request as GET (so GET routes and `*` middleware run) but `c.req.method` returns the raw method, `"HEAD"`. A scratch app confirmed middleware sees `HEAD` and the GET handler answers 200. The current auth guard (`src/routes/middleware.ts`) uses `method === "GET" ? target : prefix + "/"`, so a logged-out HEAD outside `/login/` currently gets `next = <prefix>/`.
- `deleteCookie(c, name, opt)` calls `setCookie(c, name, "", { ...opt, maxAge: 0 })`, so every attribute passed (including `secure`, `httpOnly`, `sameSite`) is emitted. The scratch script printed `a=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`.
- `parseBody` reads the whole request with `request.arrayBuffer()` before building FormData; it has no size limit. Hono ships a separate `body-limit` middleware (not used by this library).
- `serve({ fetch, port, hostname })` calls `server.listen(port, hostname)`. `hostname` is otherwise only the fallback when a request has no Host header; the request URL is still built from the Host header.

Not confirmed:
- How each browser treats a deletion Set-Cookie without `Secure` for a cookie that was set with `Secure` (not tested).
