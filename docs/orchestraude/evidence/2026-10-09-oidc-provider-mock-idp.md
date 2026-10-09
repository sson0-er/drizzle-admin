---
id: 2026-10-09-oidc-provider-mock-idp
question: Can panva oidc-provider serve as an in-process mock IdP for the example and vitest, and how is it driven without a browser?
source: npm view oidc-provider; package 9.12.2 source (lib/index.js, lib/actions/interaction.js, lib/helpers/initialize_app.js, defaults); local experiment with Node v24.21.0
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- Version 9.12.2, MIT, ESM ("type": "module"), deps koa ^3.2.1, jose ^6.2.10, debug ^4.4.3 (about 45 packages in the whole tree, oidc-provider 1.1 MB on disk); no engines field, but lib/index.js warns "Unsupported runtime" unless Node is an LTS >= v22 (Jod). Ships no .d.ts in the tarball (types not found under package; check @types/oidc-provider: not checked).
- new Provider(issuer, config) with clients:[{client_id, client_secret, redirect_uris, grant_types, response_types}] works with issuer http://localhost:PORT (no HTTPS required by the provider) and with https. Construction took about 5 ms; provider.listen(port) or http(s).createServer(provider.callback()). Default in-memory adapter and dev signing keys, with console warnings.
- Defaults: scopes_supported contains only the configured scopes plus openid; claims in the ID token follow conformIdTokenClaims (default true: ID token has only sub, email arrives only via userinfo); conformIdTokenClaims:false put email in the ID token. Refresh tokens: issueRefreshToken override returning true was used; offline_access scope. Revocation endpoint appears in discovery only with features.revocation.enabled=true. end_session_endpoint is advertised.
- features.devInteractions (default enabled): GET /interaction/:uid renders login/consent HTML; POST /interaction/:uid with application/x-www-form-urlencoded prompt=login&login=<accountId> logs in any account id (password ignored), then POST prompt=consent grants. findAccount config resolves claims. Custom interaction (interactions.url) not tried.
- Driving with fetch only: GET /auth -> 303 /interaction/<uid> (cookies _interaction, _interaction_resume, Secure/HttpOnly/SameSite=Lax) -> POST login -> 303 /auth/<uid> -> 303 new /interaction/<uid2> (consent) -> POST consent to the FIRST uid path -> 303 /auth/<uid2> -> 303 redirect_uri?code&state&iss. A manual cookie jar and manual redirect handling were enough (redirect: "manual").
- After a logout of the app only, the IdP session cookie (_session) remained: the next login skipped the login prompt but showed consent again.
Not confirmed: custom auto-login interaction; Secure-cookie handling by the jar when the IdP is plain http (jar ignored attributes).
