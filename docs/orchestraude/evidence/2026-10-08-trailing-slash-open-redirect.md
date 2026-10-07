---
id: 2026-10-08-trailing-slash-open-redirect
question: Can the trailing-slash catch-all redirect off-site when basePath is "/", and does the task 14 code (renderPage, buildApp, catch-all) match the amended design?
source: src/routes/index.ts, src/routes/context.ts, src/admin.ts (working tree 2026-10-08); scratch script via `npx tsx` calling `admin.fetch` (hono 4.13.13)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `normalizeBasePath("/")` gives prefix `""`, so with basePath "/" every unmatched GET reaches the catch-all with the raw path (src/admin.ts).
- The original rule "path not ending in `/` → 301 to path + `/` + search" yields `Location: //evil.example/` for `GET //evil.example` and `/\evil.example/` for `GET /%5Cevil.example` (task 14 high review finding; `c.req.path` is percent-decoded, so `%5C` becomes `\`). Browsers treat both as protocol-relative URLs to another host (unverified here; standard WHATWG URL parsing behaviour).
- With the fixed catch-all (rest = path after the prefix; 404 when rest starts with `//` or contains `\`), the script gave, for basePath "/" and "/admin": `//evil.example`, `/%5Cevil.example`, `///evil.example` → 404 without Location; `/x?a=1` → 301 `/x/?a=1` (or `/admin/x/?a=1`); `/%2F%2Fevil.example` → 301 `/%2F%2Fevil.example/?a=1` (stays percent-encoded, a single-slash same-site path).
- `renderPage(c, status, page: JSXNode | ((flash) => JSXNode), opts?)` consumes flash only for 200/400 non-minimal and passes it to the function form (src/routes/context.ts).
- `buildApp(state): Hono` builds `new Hono<AdminEnv>()` and returns it cast to plain `Hono`; src/admin.ts stores it as `Hono` (`app: Hono | undefined`).

Not confirmed:
- Behaviour of every browser on `/\host` Locations (only the reviewer's statement and common knowledge).
