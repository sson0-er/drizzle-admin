# Review findings

high: 0, medium: 0, low: 9

## high


## medium


## low

- [quality] Convoluted handler type in mock-idp
  - location: example/oidc/mock-idp.ts:250
  - detail: The conditional-infer type `(typeof Provider.prototype)["callback"] extends () => infer H ? H : never` can be written as `ReturnType<Provider["callback"]>`, which says the same thing directly.
  - evidence: (none)
- [quality] identityOf re-narrows fields the claims hook already normalizes
  - location: example/oidc/app.tsx:41
  - detail: claimsHook always yields a string email and a boolean email_verified, so `typeof auth.email === "string"` in identityOf is largely redundant. The project convention prefers dropping guards that preceding code makes impossible, or using a short why-comment if the library type cannot show it.
  - evidence: (none)
- [quality] console.error spy restored outside try/finally
  - location: test/example-oidc.test.ts:601
  - detail: `log.mockRestore()` is skipped if an earlier expect fails, so the spy leaks into later tests. Restoring it in the existing afterEach (vi.restoreAllMocks) would be simpler and safer.
  - evidence: (none)
- [security] Logout echoes the IdP's revocation error text
  - location: example/oidc/app.tsx:137
  - detail: POST /oidc/logout calls revokeSession(c) without a try/catch. When the IdP rejects the revocation request, @hono/oidc-auth throws HTTPException(500, { message: `OAuth2Error: [${error.error}] ${error.error_description}` }) (node_modules/@hono/oidc-auth/dist/index.mjs:236), and Hono's default errorHandler returns err.getResponse(), so the IdP's error_description becomes the text/plain 500 body. This is the same leak the callback handler was designed to avoid. The session cookie is still deleted, because revokeSession deletes it before the request and c.newResponse keeps the Set-Cookie. The design's Errors section sends 'other request-time errors' to the default handler, so this matches the design and the impact is small: plain text, shown only to the user who signed out, and only in real mode on a revocation failure. Optional fix: wrap revokeSession the same way as the callback (log error.name, then still 303 to /), or record in the design that revocation failures may show the IdP text.
  - evidence: (none)
- [spec] design ambiguity: callback-failure test allows more than one Set-Cookie per flow cookie, so the handler's own `state` deletion is not proven
  - location: test/example-oidc.test.ts:582
  - detail: The task asks for exactly one Set-Cookie per name, and test-strategy.md says 'a Set-Cookie line with Max-Age=0 and Path=/oidc/callback per name'. But @hono/oidc-auth 1.10.0 calls deleteCookie(c, "state", { path }) before it throws (dist/index.mjs:287), so `state` always appears twice and exactly-one cannot hold. Allowing at least one line is a reasonable reading. Side effect: the test would still pass if the handler stopped deleting `state`, and the design's `secure: true` is not checked at all. Optional tightening: also require, for each name, a line that contains `Secure`. Only the handler sets that attribute here, so this pins the handler's four deletions. Also ask the orchestrator to update the test-strategy.md wording to 'at least one line per name'.
  - evidence: (none)
- [spec] design ambiguity: claimsHook narrows claims.email with typeof instead of the design's literal expression
  - location: example/oidc/app.tsx:22
  - detail: example-oidc.md step 4 gives `email: claims?.email || orig?.email || ""` and `email_verified: claims?.email ? ... : ...`. IDToken claims are JsonValue, so that expression does not type-check against OidcAuthClaims.email. The implementation treats a non-string email claim as absent and falls back to orig. The result is the same for every string or missing email, and only differs for a malformed non-string claim. This is recorded in the task History. Ask the orchestrator to update step 4 to the typeof form so the design and the code agree.
  - evidence: (none)
- [tests] Callback-failure log assertion is weak and the spy can leak
  - location: test/example-oidc.test.ts:487
  - detail: The test only checks the log argument does not contain the IdP detail. It should pin the exact logged line with toHaveBeenCalledWith("drizzle-admin OIDC example: sign-in callback failed:", expect.any(String)), or the exact error name. Also log.mockRestore() runs after the assertions, so a failing assertion leaves console.error mocked for later tests; restore it in afterEach with vi.restoreAllMocks().
  - evidence: (none)
- [tests] Callback failure covers only the IdP error-parameter path
  - location: test/example-oidc.test.ts:470
  - detail: Only ?error=access_denied is tried. A row table with a missing state, or a code with a state that does not match the cookie, would exercise the other throw paths of processOAuthCallback behind the same generic 400 page.
  - evidence: (none)
- [tests] Shell-isolation test is indirect
  - location: test/example-oidc.test.ts:459
  - detail: The OIDC_* variables are stubbed after beforeAll, and makeApp passes an explicit oidc object. The test passes whenever the app does not read process.env. The 403/200 outcome alone does not show which source supplied the scopes. This is acceptable, but asserting the scope the IdP received (the authorize URL's scope parameter equals "openid email offline_access") would make the failure point at the cause.
  - evidence: (none)

