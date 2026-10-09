---
id: 2026-10-09-hono-oidc-auth-package
question: For the OIDC example, what is @hono/oidc-auth's version, peers, configuration, API, session cookie and return-URL behaviour?
source: npm view @hono/oidc-auth (registry); package tarball 1.10.0 (README.md, dist/index.mjs, dist/index.d.mts) read locally; repo honojs/middleware packages/oidc-auth
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- Latest 1.10.0 (published 2026-08-05), MIT, engines node >=18, peer hono >=3.0.0 (covers 4.13.13), one dependency oauth4webapi ^3.8.6 (3.8.8 resolved). Imports hono/adapter, hono/cookie, hono/factory, hono/http-exception, hono/jwt.
- Exports: getAuth, getAuthorizationServer, getClient, initOidcAuthMiddleware, oidcAuthMiddleware, processOAuthCallback, revokeSession, setClient, setClientAuth (+ types IDToken, OidcAuth, OidcAuthEnv, OidcAuthRefreshErrorHook, OidcClaimsHook).
- Config: env vars OIDC_AUTH_SECRET (min 32 chars), OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET (required), OIDC_REDIRECT_URI (default /callback; path or full URL), OIDC_SCOPES (default: all scopes_supported; each must be in scopes_supported), OIDC_AUTH_REFRESH_INTERVAL (900 s), OIDC_AUTH_EXPIRES (86400 s), OIDC_COOKIE_NAME (oidc-auth), OIDC_COOKIE_PATH (/), OIDC_COOKIE_DOMAIN, OIDC_AUDIENCE, OIDC_AUTH_EXTERNAL_URL, OIDC_JWT_ALG (HS256). Each value comes from initOidcAuthMiddleware(config) first, else hono/adapter env(c): process.env on Node/Bun, c.env on workerd (source: setOidcAuthEnv; hono adapter helper). Configuring twice on one context throws 500.
- Session cookie "oidc-auth": HS256 signed JWT (signed, NOT encrypted) containing sub, email (default claims hook), rtk (the refresh token), rtkexp, ssnexp. Attributes set: Path=/, HttpOnly, Secure (always); no SameSite, no Max-Age/Expires. Custom claims via c.set("oidcClaimsHook", fn).
- Login flow: middleware generates state, nonce, PKCE S256 code_verifier; stores them plus "continue" in cookies (Path=<redirect path>, HttpOnly, Secure); callback is handled when the middleware sees the redirect URI path, or via processOAuthCallback(c) on a route. Callback validates state, code_verifier, nonce (requireIdToken) and redirects to the "continue" cookie value or "/".
- Return URL: "continue" = c.req.url of the request that hit oidcAuthMiddleware (or OIDC_AUTH_EXTERNAL_URL + path+query); not validated, not customizable by API.
- Logout: revokeSession(c) deletes the cookie and, only if the IdP advertises revocation_endpoint, revokes the refresh token; it does not call end_session_endpoint (no RP-initiated logout). Refresh: after rtkexp getAuth refreshes with the refresh token; empty rtk -> cookie deleted, user must log in again.
- AS metadata (discovery) and client are cached only on the Hono context (c.set), i.e. per request; no module-level cache. After next(), the middleware sets Cache-Control: private, no-cache and re-sets the session cookie.
- getAuth(c) needs a Hono Context (c.get/c.set, getCookie, setCookie, env); it cannot take a bare Request.
Not confirmed: behaviour in Safari for Secure cookies on http://localhost; whether Firefox applies Lax by default to cookies without SameSite.
