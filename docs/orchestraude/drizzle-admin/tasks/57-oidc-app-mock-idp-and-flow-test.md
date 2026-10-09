---
id: 57-oidc-app-mock-idp-and-flow-test
depends_on: [56-oidc-shared-admin-and-config]
status: pending
attempts: 0
---
# Task 57: oidc-app-mock-idp-and-flow-test

## Goal
OIDC SSO example, part 2 (decision 053 points 2, 4-8, 10, 12, 15). The OIDC app runs against an in-process mock IdP over `https://localhost`, and a vitest test drives the whole sign-in flow without network access:
- `example/oidc/cert.ts`: run-time localhost certificate.
- `example/oidc/mock-idp.ts`: `oidc-provider` on `127.0.0.1`.
- `example/oidc/app.tsx`: `createOidcExampleApp`, with the `WeakMap` getUser bridge, the allowlist with its 403 page, the login route validating `next`, the callback with a generic 400 page, the Origin-checked logout and the `/` page.
- `test/helpers/oidc-global-setup.ts` and `vitest.config.ts` (`pool: "forks"`, `globalSetup`). Test workers trust the generated certificate only through `NODE_EXTRA_CA_CERTS`.
- `test/example-oidc.test.ts` gains the IdP-backed cases: round trip, allowlist outcomes, TLS negative control, shell isolation, callback failure, logout Origin check and the `/` page.

TLS verification is never disabled. The process wiring (`server.ts`, `launch.ts`, `pnpm example:oidc`) and the docs come in task 58.

## Scope
### Files to touch
- example/oidc/cert.ts (new)
- example/oidc/mock-idp.ts (new)
- example/oidc/app.tsx (new)
- test/helpers/oidc-global-setup.ts (new)
- vitest.config.ts (add `pool` and `globalSetup` with the design comment; keep everything else)
- test/example-oidc.test.ts (append the IdP-backed cases; the task 56 tables stay unchanged)

### Do not touch
- src/** (no library change).
- example/oidc/return-path.ts, allowlist.ts, mode.ts, config.ts (task 56). If one of them seems wrong, stop and report it; do not fix it here.
- example/app.ts, example/host-guard.ts, example/server.ts, example/schema.ts, example/seed.ts.
- example/oidc/server.ts, example/oidc/launch.ts (task 58).
- test/helpers/app.ts, test/helpers/html.ts, test/helpers/db.ts (use `createClient`, `parse`/`qs`/`attr` as they are), test/tls-verification.test.ts and every other existing test file.
- package.json, pnpm-lock.yaml (no dependency or script change here), tsconfig*.json, biome.json, mise.toml, pnpm-workspace.yaml, .gitignore, scripts/**, .github/**.
- README.md, CHANGELOG.md, CLAUDE.md (task 58).
- docs/** (except this task's History).
- Never write `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized`, `allowInsecureRequests`, `checkServerIdentity`, `strict-ssl`, `strictSsl` or `--insecure` in any file, and never set any of them in a command you run. The negative control below proves verification stays on without them.
- Do not commit.

## Implementation notes
Normative: example-oidc.md sections "Flow", `cert.ts`, `mock-idp.ts`, `app.tsx`, "Errors"; project-setup.md "vitest.config.ts"; test-strategy.md "Helpers" (`oidc-global-setup.ts`) and "OIDC example (decision 053)".

- **Order**:
  1. Write cert.ts, the global setup and the vitest.config.ts change first (test infrastructure).
  2. Then write all new test cases. Run them and record in History that they fail because mock-idp.ts / app.tsx do not exist yet.
  3. Then implement mock-idp.ts and app.tsx.
- **cert.ts**:
  - The three exported functions exactly as specified. `selfsigned.generate` gets the attribute and options literal of example-oidc.md, including `algorithm: "sha256"`, `keyType: "ec"`, `notAfterDate` now + 30 days, `basicConstraints cA: false` and SAN `localhost` / `127.0.0.1`.
  - `mkdtempSync(join(tmpdir(), "drizzle-admin-oidc-"))`. `key.pem` is written with mode 0600.
  - The file names are module-private constants shared by write and read.
- **mock-idp.ts**:
  - `https.createServer({ key, cert }, handler)` listens on `127.0.0.1:<port>` first. Then `issuer = "https://localhost:" + actualPort` and `new Provider(issuer, config)`, and the handler delegates to `provider.callback()`.
  - `config` exactly as listed: client, scopes, claims, `findAccount` with `email_verified: true`, `issueRefreshToken: () => true`, `conformIdTokenClaims: false`, `devInteractions` and `revocation` enabled.
  - `close()` calls `closeAllConnections()` and then `close()`.
  - The oidc-provider warnings about the dev adapter and keys are accepted. Do not silence them by changing config beyond the design.
  - If `@types/oidc-provider` 9.12.1 rejects an option the design lists, report it in History. Do not change the option, and do not cast to `any` without a why-comment.
- **app.tsx**: steps 1-11 of example-oidc.md `app.tsx`, in that order.
  - `createOidcExampleApp(opts: { secret; oidc: Required<OidcAuthEnv>; allow: Allowlist })` returns `{ app, admin }`.
  - `createExampleAdmin` is called with `getUser: async (req) => users.get(req) ?? null` and `loginUrl: "/oidc/login"`.
  - `initOidcAuthMiddleware(opts.oidc)` is registered on `*`.
  - The claims hook is registered on `*`. It keeps `email_verified` following whichever email is kept, as in step 4.
  - `identityOf` follows step 5. The admin user is `{ id: sub, name: email || sub }`.
  - The `/admin/*` bridge is registered **before** `app.route("/admin", admin.app)`.
  - `/oidc/login` runs `oidcAuthMiddleware()` and then the handler (302 `safeReturnPath(next, "/admin")` or 403).
  - `/oidc/callback` uses try/catch around `processOAuthCallback(c)`. On any error:
    - delete the four flow cookies with `deleteCookie(c, name, { path: "/oidc/callback", secure: true })`;
    - log exactly one line `console.error("drizzle-admin OIDC example: sign-in callback failed:", error instanceof Error ? error.name : "unknown error")`;
    - answer 400 with the `SignInFailedPage`.
  - `POST /oidc/logout` uses `csrf()` from `hono/csrf` and `revokeSession(c)`, then 303 `/`.
  - `GET /` shows the signed-in or signed-out page.
  - Pages: exact English texts and markup from example-oidc.md, `<title>drizzle-admin OIDC demo</title>`, no CSS, no script, JSX-escaped only. The 403 page, the sign-in-failed page and the claims hook are module-private.
  - Example texts are not library UI strings, so they do not go into `src/messages.ts` (decision 053 point 11).
- **test/helpers/oidc-global-setup.ts**:
  - Default-exported async function. It calls `writeLocalhostCert()`, sets `process.env.NODE_EXTRA_CA_CERTS = certPath` and `process.env.OIDC_MOCK_CERT_DIR = dir`, and returns a teardown that runs `rmSync(dir, { recursive: true, force: true })`.
  - The `rmSync` of the directory it created is specified by the design. The CLAUDE.md `gio trash` rule is about agents deleting repository files, not about test teardown of a temp dir.
- **vitest.config.ts**: add `pool: "forks"` and `globalSetup: ["test/helpers/oidc-global-setup.ts"]` with the four-line comment of project-setup.md "vitest.config.ts", verbatim in meaning. `include`, `environment`, `testTimeout` and `hookTimeout` and their comments stay.
- **test/example-oidc.test.ts**: append; do not edit the task 56 tables.
  - Planner choice: put every IdP-backed case inside one `describe` (e.g. "OIDC flow against the mock IdP") that owns `beforeAll` / `afterAll` / `afterEach`, so the unit tables at file level do not start an IdP. test-strategy.md describes the hooks without saying where they go.
  - `beforeAll`:
    - First save and delete every `process.env` key starting with `OIDC_` except `OIDC_MOCK_CERT_DIR`. Restore them in `afterAll`.
    - Then `startMockIdp({ ...readLocalhostCert(process.env.OIDC_MOCK_CERT_DIR!), port: 0, clientId: "test-client", clientSecret: "test-client-secret", redirectUris: ["http://localhost/oidc/callback"] })`. The `!` gets a why-comment: the global setup sets it.
  - `afterAll`: `idp.close()`. `afterEach`: `vi.unstubAllEnvs()`.
  - `makeApp(allow)`:
    - Calls `createOidcExampleApp` with `secret: TEST_SECRET` and the full `Required<OidcAuthEnv>` of test-strategy.md: issuer from `idp.issuer`, client values, redirect URI, `"o".repeat(32)`, scopes `openid email offline_access`, audience `""`, and the fixed `config.ts` values for the other keys.
    - Returns `createClient((req) => app.fetch(req))`.
    - Default allow: `{ subjects: ["demo"], emailDomains: [] }`.
  - The test-local `signInAtIdp(authorizeUrl, login)` and `signIn(client, login)` exactly as test-strategy.md describes:
    - real `fetch`, `redirect: "manual"`, its own `Map` cookie jar per call;
    - read the first `<form>`'s `action` with `helpers/html.ts`;
    - post `prompt=login&login=<login>&password=x` or `prompt=consent`;
    - stop at 10 steps.
    - If the consent page's `action` does not lead to consent (unverified in the design), POST consent to the login page's `action` as the design allows, and record which applied in History.
  - An absolute `Location` on the app origin: assert its origin is `http://localhost`, then use its path.
  - Cases (test-strategy.md, one `it` or one `it.each` row each, exact statuses and `Location` values):
    - the round trip, steps (1)-(9), in one `it`;
    - the allowlist outcomes table (5 rows, fresh app and client per row; the `mallory` row also asserts no `.user-name` element on the 403 admin response; the denied rows assert the 403 page has a form posting to `/oidc/logout`);
    - the TLS negative control;
    - shell isolation with the three `vi.stubEnv` calls;
    - callback failure;
    - logout with `Origin: https://evil.example` → 403 and `oidc-auth` still in the jar;
    - `GET /` signed out and signed in.
  - **TLS negative control**:
    - `generateLocalhostCert()` gives a second certificate.
    - `https.createServer({ key, cert }, (_req, res) => res.end("ok"))` listens on `127.0.0.1:0`.
    - `fetch("https://localhost:<port>/")` rejects with a `TypeError` whose `cause.code` is exactly `DEPTH_ZERO_SELF_SIGNED_CERT`.
    - Close the server with `closeAllConnections()` + `close()` in `finally`.
  - **Callback failure**:
    - Request `GET /oidc/callback?error=access_denied&error_description=detail-from-idp&state=x` with no flow cookies.
    - Spy on `console.error` with `vi.spyOn(console, "error").mockImplementation(() => {})`.
    - Expect: 400; the body contains `Sign-in failed` and neither `access_denied` nor `detail-from-idp`.
    - One `Set-Cookie` per name (`state`, `nonce`, `code_verifier`, `continue`) with `Max-Age=0` and `Path=/oidc/callback`.
    - The spy was called once, and its second argument does not contain `detail-from-idp`.
- **Non-vacuity checks, run once and reverted** (record each outcome in History; neither stays in the code):
  1. Point the negative control at the trusted certificate (`readLocalhostCert(process.env.OIDC_MOCK_CERT_DIR!)` instead of a new one). The negative-control test must then fail, because `fetch` succeeds. Revert.
  2. Run `mise exec -- pnpm vitest run test/example-oidc.test.ts --pool=threads` once. Record whether the flow cases fail with a TLS error, as evidence 2026-10-09-extra-ca-certs-flow says. This is informational. If threads unexpectedly passes, record it; the `forks` pin stays as designed.
- If a step of the flow behaves differently from example-oidc.md "Flow" (e.g. a different status or `Location`), stop and report blocked with the observed values. Do not adapt the expectation.
- Exports: `cert.ts` exports the three functions; `mock-idp.ts` exports `MockIdpOptions`, `MockIdp` and `startMockIdp`; `app.tsx` exports only `createOidcExampleApp`. Record any other export in History.

## Definition of Done
- [ ] `vitest.config.ts` contains `pool: "forks"` and `globalSetup: ["test/helpers/oidc-global-setup.ts"]` with the design comment. `git diff vitest.config.ts` removes no line.
- [ ] Tests, test/example-oidc.test.ts:
  - The round trip `it` passes with the exact `Location` values (1)-(9) of test-strategy.md, including `.user-name` = `demo@example.test` and `oidc-auth` gone from the jar after logout.
  - The five allowlist rows pass with the statuses of the table.
  - The TLS negative control passes with `cause.code` `DEPTH_ZERO_SELF_SIGNED_CERT`.
  - The shell-isolation `it` passes (302 `/admin/users/`, then 200).
  - The callback-failure `it` passes with the cookie-deletion and log assertions.
  - The logout Origin `it` passes (403, `oidc-auth` kept).
  - The two `/` page cases pass.
  - History records that these cases failed before mock-idp.ts / app.tsx existed.
- [ ] `git diff test/example-oidc.test.ts` has no removed lines (decision 041 import-line exception applies). The task 56 tables are unchanged.
- [ ] Non-vacuity check 1 was run: the negative control failed against the trusted certificate and was reverted. Check 2 (`--pool=threads`) was run and its outcome is recorded.
- [ ] The global setup cleans up. Before and after one `mise exec -- pnpm test`, the number of `drizzle-admin-oidc-*` entries in `node -p "require('os').tmpdir()"` is the same. Paste both counts in History.
- [ ] test/tls-verification.test.ts (unchanged) passes; it now also scans cert.ts, mock-idp.ts, app.tsx and the global setup.
- [ ] `git diff --stat src/ package.json pnpm-lock.yaml test/helpers/app.ts test/helpers/html.ts test/tls-verification.test.ts example/app.ts example/oidc/config.ts example/oidc/mode.ts example/oidc/allowlist.ts example/oidc/return-path.ts` is empty.
- [ ] `git diff --name-only` plus `git status --short` (new files) list only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes, run twice in a row (the flow test uses a real port and timing; both runs pass).

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md (sections "Flow", "`example/oidc/cert.ts`", "`example/oidc/mock-idp.ts`", "`example/oidc/app.tsx`", "Errors")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md#vitest.config.ts
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#Helpers (`oidc-global-setup.ts`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#OIDC example (decision 053)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md (`createExampleAdmin`)
- Decision: docs/orchestraude/decisions/053-oidc-sso-example.md (points 2, 4-8, 10, 12, 15)
- Evidence: docs/orchestraude/evidence/2026-10-09-selfsigned-cert-generation.md, docs/orchestraude/evidence/2026-10-09-oidc-provider-mock-idp.md, docs/orchestraude/evidence/2026-10-09-oidc-auth-oidc-provider-e2e.md, docs/orchestraude/evidence/2026-10-09-extra-ca-certs-flow.md, docs/orchestraude/evidence/2026-10-09-oidc-example-runtime-checks.md, docs/orchestraude/evidence/2026-10-09-oidc-example-package-types.md, docs/orchestraude/evidence/2026-10-09-hono-oidc-auth-package.md, docs/orchestraude/evidence/2026-10-09-oidc-auth-http-issuer.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
