---
id: 2026-10-09-oidc-auth-http-issuer
question: Does @hono/oidc-auth work against an http://localhost issuer?
source: oauth4webapi 3.8.6 build/index.js (checkProtocol, performDiscovery); @hono/oidc-auth 1.10.0 dist/index.mjs; local experiment with Node v24.21.0 (oauth4webapi 3.8.8)
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- oauth4webapi enforces HTTPS for discovery and for every endpoint request (token, revocation, jwks, userinfo...) unless the caller passes the allowInsecureRequests option symbol; there is no localhost exemption. @hono/oidc-auth 1.10.0 never passes that option and offers no setting for it.
- Experiment: discoveryRequest(new URL("http://localhost:4010")) throws OAUTH_HTTP_REQUEST_FORBIDDEN "only requests to HTTPS are allowed"; with the option it returns 200. With oidcAuthMiddleware and an http issuer the app answered 500 "Invalid session" (the middleware's catch hides the real error).
- Setting c.set("oidcAuthorizationServer", ...) skips discovery but the token endpoint call still goes through the same HTTPS check (source, resolveEndpoint with enforceHttps), so it does not remove the constraint (not run).
- Working configuration found: the IdP on https://localhost:<port> with a self-signed certificate, and process.env.NODE_TLS_REJECT_UNAUTHORIZED=0 set at runtime before the first fetch (Node prints a warning). The redirect URI of the app may stay http://localhost (client side). NODE_EXTRA_CA_CERTS was not tried (must be set at process start).
Not confirmed: patching/wrapping approaches; behaviour of browsers with a self-signed IdP certificate (needs a trusted cert or manual exception).
