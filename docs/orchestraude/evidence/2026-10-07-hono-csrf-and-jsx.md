---
id: 2026-10-07-hono-csrf-and-jsx
question: How do hono/csrf and hono/jsx behave (Origin check, escaping, tsconfig)?
source: hono@4.13.13 node_modules source (dist/middleware/csrf/index.js), runtime probe, https://hono.dev/docs/guides/jsx
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: hono/csrf only checks non-GET/HEAD/OPTIONS requests whose Content-Type is form-urlencoded, multipart/form-data or text/plain (missing content-type counts as text/plain). It allows the request if EITHER Sec-Fetch-Site is same-origin OR Origin equals the request URL origin (defaults); a request with neither header is rejected 403. Default origin is derived from c.req.url, so behind a reverse proxy the URL origin may differ from the public one (origin option needed). hono/jsx escapes text children and attribute values (probe: <script> and quotes escaped); String(jsx element) yields HTML string. tsconfig needs jsx: react-jsx and jsxImportSource: hono/jsx. Unknown: async component/Suspense behavior when stringifying.
