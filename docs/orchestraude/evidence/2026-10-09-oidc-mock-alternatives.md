---
id: 2026-10-09-oidc-mock-alternatives
question: How do oauth2-mock-server and a hand-written jose mock compare with oidc-provider as a mock IdP?
source: npm view oauth2-mock-server; package 9.2.0 README and local run (Node v24.21.0)
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- oauth2-mock-server 9.2.0, MIT, engines node ^22.12 || ^24 || ^26, deps jose ^6.2.10 and basic-auth ^3.0.0 (about 124 KB). In-process start: new OAuth2Server(); issuer.keys.generate("RS256"); start(port, "localhost"); HTTPS via cert/key options (issuer URL then becomes https). /authorize auto-redirects to the callback without any login page (no interaction to drive); supports code+PKCE, refresh token grant, userinfo, /revoke (always 200), /endsession, /introspect; hooks via service events (BeforeTokenSigning, BeforeUserinfo, BeforeAuthorizeRedirect, ...).
- Its discovery document has NO scopes_supported (checked by running it). @hono/oidc-auth 1.10.0 throws 500 "The supported scopes information is not provided by the IdP" in that case (source). Whether scopes_supported can be injected by an event hook was not checked.
- Hand-written jose mock: not built; fidelity relative to oauth4webapi validation (iss, aud, nonce, exp, iat, optional at_hash, client_secret_basic parsing) not tested.
Not confirmed: oauth2-mock-server working end to end with @hono/oidc-auth (not run); id_token claims customization for email.
