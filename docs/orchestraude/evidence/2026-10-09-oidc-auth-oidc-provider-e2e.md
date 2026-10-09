---
id: 2026-10-09-oidc-auth-oidc-provider-e2e
question: Does the full flow (login redirect, IdP, callback, return, logout) run with fetch only against @hono/oidc-auth + oidc-provider inside vitest?
source: local experiment in a scratch dir: hono 4.13.13, @hono/oidc-auth 1.10.0, oidc-provider 9.12.2, @hono/node-server 2.1.4, vitest 5.0.3, Node v24.21.0
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- Passed end to end in plain Node and inside vitest (1 test, 276 ms total): IdP on https://localhost:4010 (self-signed cert from openssl, issued with SAN localhost), app on http://localhost:4011, NODE_TLS_REJECT_UNAUTHORIZED=0 set in process.env at runtime, OIDC config injected through initOidcAuthMiddleware({...}) (process.env also works on Node by source). Unauthenticated GET -> 302 to IdP /auth; login+consent via fetch; callback 302; admin-like page returned JSON of getAuth (sub, email, rtk, rtkexp, ssnexp); logout (revokeSession) deleted the cookie and revocation succeeded when the IdP advertised revocation; the next request redirected to the IdP again.
- Return-to pattern works: a login route app.use("/login", oidcAuthMiddleware()) with handler redirecting to the query next: the middleware stored the login URL (with ?next=) in "continue", the callback redirected back to /login?next=..., the handler then redirected to next. The library does not validate next; the handler does.
- Refresh: with OIDC_AUTH_REFRESH_INTERVAL=1 a request after 2.1 s stayed authenticated (token rotation not inspected).
- With conformIdTokenClaims default (true) the session email was "" because email is not in the ID token; conformIdTokenClaims:false fixed it.
- A Hono sub-app mounted with app.route receives the same Request object as the outer middleware (c.req.raw identical, checked), relevant because drizzle-admin getUser receives only c.req.raw (src/routes/middleware.ts) while getAuth needs a Hono Context.
Not confirmed: browser behaviour (cookies, certificate trust); NODE_EXTRA_CA_CERTS route; running under the repo's own vitest config/CI (scratch used vitest 5.0.3 default config).
