# Interface: OIDC SSO example

Added 2026-10-09 (decision 053). Changed 2026-10-10: sign-in allowlist (Q21, decision 053 point 12): new `example/oidc/allowlist.ts`; environment parsing moves from `server.ts` into the testable `example/oidc/config.ts`.
Changed 2026-10-10 (design review, OIDC round): new `example/oidc/mode.ts` (one mode rule, refusal of disabled TLS verification); every library setting passed explicitly; callback failures answered with a generic 400 page; real-mode default scopes; exact error texts; README mount warning.
Files: `example/oidc/cert.ts`, `example/oidc/mock-idp.ts`, `example/oidc/return-path.ts`, `example/oidc/allowlist.ts`, `example/oidc/mode.ts`, `example/oidc/config.ts`, `example/oidc/app.tsx`, `example/oidc/server.ts`, `example/oidc/launch.ts`, plus `createExampleAdmin` in `example/app.ts` (example.md). Like the first example it imports the library from `../../src/index.js` (decision 005), uses the seeded in-memory SQLite admin, and is not published (`files` does not list `example/`).

## Responsibilities
Changed 2026-10-10: only allowlisted users reach the admin (Q21).
- Show external auth mode (`auth.getUser` + `auth.loginUrl`) signing in through OpenID Connect with `@hono/oidc-auth`.
- Let only users on an allowlist into the admin; everyone else signed in at the IdP gets a 403 page (fail closed).
- Run offline with a local mock IdP (`oidc-provider`) over `https://localhost`, trusted by Node through `NODE_EXTRA_CA_CERTS`; or against a real IdP configured by environment variables.
- Never disable TLS verification (decision 053 point 2).
- Be example code: not a hardened production configuration (README says so).

## Flow (what the test and a manual run go through)
Changed 2026-10-10: the mock demo user is `demo`; step 5a and 6a cover a user not on the allowlist (Q21).
1. `GET /admin/users/?q=a` without a session → the admin's guard → 302 `/oidc/login?next=%2Fadmin%2Fusers%2F%3Fq%3Da` (library behavior, decision 047).
2. `GET /oidc/login?next=...` → `oidcAuthMiddleware()` (no session) sets the `state`, `nonce`, `code_verifier` and `continue` cookies (`continue` = this full URL) → 302 to the IdP's authorization endpoint.
3. IdP: login page (user name `demo` in mock mode), consent page → 303 to `OIDC_REDIRECT_URI?code&state&iss`.
4. `GET /oidc/callback?...` → `processOAuthCallback(c)` checks state, PKCE and nonce, sets the `oidc-auth` session cookie → 302 to the `continue` URL (`/oidc/login?next=...`).
5. `GET /oidc/login?next=...` again → session present and allowed → 302 `safeReturnPath(next, "/admin")` = `/admin/users/?q=a`.
5a. Session present but not allowed → 403 "access denied" page (no redirect, so no loop through the admin's guard).
6. `GET /admin/users/?q=a` → bridge puts the user into the `WeakMap` → `getUser` returns it → 200, the header shows the user's name.
6a. Any `/admin/*` request with a session that is not allowed → the bridge answers the same 403 page itself; the admin app is not called.
7. `POST /oidc/logout` (Origin-checked) → `revokeSession(c)` → 303 `/`. The next admin request starts again at step 1; the IdP's own session survives (its login prompt is skipped, consent is shown again).

## API

### `example/oidc/cert.ts`
Changed 2026-10-10 (design review): `generateLocalhostCert` is exported, because the TLS negative control in the test needs a second certificate that is not on disk.
```ts
export async function generateLocalhostCert(): Promise<{ key: string; cert: string }>;
export async function writeLocalhostCert(): Promise<{ dir: string; certPath: string }>;
export function readLocalhostCert(dir: string): { key: string; cert: string };
```
- `generateLocalhostCert`: `selfsigned.generate([{ name: "commonName", value: "localhost" }], { keyType: "ec", algorithm: "sha256", notAfterDate: <now + 30 days>, extensions: [{ name: "basicConstraints", cA: false }, { name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] }] })` (evidence: 2026-10-09-selfsigned-cert-generation; `algorithm` must be given, the default is sha1); returns `{ key: result.private, cert: result.cert }`.
- `writeLocalhostCert`: calls it; `dir = mkdtempSync(join(tmpdir(), "drizzle-admin-oidc-"))` (mode 0700); writes `cert.pem` (the certificate) and `key.pem` (the private key, mode 0600). Returns `dir` and `certPath = join(dir, "cert.pem")`.
- `readLocalhostCert`: reads `key.pem` and `cert.pem` from `dir` (UTF-8). File names are module-private constants shared by both functions.
- Nothing is committed: the key exists only in the temporary directory, which the launcher and the vitest teardown remove with `rmSync(dir, { recursive: true, force: true })`.

### `example/oidc/mock-idp.ts`
Changed 2026-10-10: accounts carry `email_verified: true` (Q21, needed by the domain allowlist).
```ts
export interface MockIdpOptions {
  key: string;            // PEM
  cert: string;           // PEM
  port: number;           // 0 = ephemeral (tests)
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
}
export interface MockIdp { issuer: string; close(): Promise<void> }
export async function startMockIdp(opts: MockIdpOptions): Promise<MockIdp>;
```
- Creates `https.createServer({ key, cert }, handler)` and listens on `127.0.0.1:<port>` first, so the issuer can use the real port: `issuer = "https://localhost:" + actualPort` (Node reaches a `127.0.0.1` server through `localhost`, evidence: 2026-10-09-oidc-example-runtime-checks). Then `new Provider(issuer, config)` and the handler delegates to `provider.callback()`. Loopback only: `devInteractions` lets anyone sign in as any user name (the allowlist decides who gets in).
- `config` (evidence: 2026-10-09-oidc-provider-mock-idp, 2026-10-09-oidc-auth-oidc-provider-e2e):
  - `clients: [{ client_id, client_secret, redirect_uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }]` (token endpoint auth stays the default `client_secret_basic`, which `@hono/oidc-auth` uses).
  - `scopes: ["openid", "email", "offline_access"]`, `claims: { openid: ["sub"], email: ["email", "email_verified"] }`.
  - `findAccount: (_ctx, id) => ({ accountId: id, claims: () => ({ sub: id, email: id + "@example.test", email_verified: true }) })`.
  - `issueRefreshToken: () => true` (otherwise the session's `rtk` is empty), `conformIdTokenClaims: false` (puts the email claims into the ID token), `features: { devInteractions: { enabled: true }, revocation: { enabled: true } }`.
  - Defaults otherwise (in-memory adapter, development keys; oidc-provider prints warnings about both, accepted).
- `close()`: `server.closeAllConnections()` then `server.close()` (keep-alive connections from `fetch` would otherwise delay it).

### `example/oidc/return-path.ts`
```ts
export function safeReturnPath(next: string | undefined, prefix: string): string;
```
A copy of the rules of `safeNext` (`src/auth/redirect.ts`, decisions 029 and 032; internal to the library, so not imported). `fallback = prefix + "/"`. Return `fallback` when any of these holds, otherwise `url.pathname + url.search`:
1. `next` is missing, does not start with `/`, or starts with `//`.
2. Raw `next` contains a control character (U+0000-U+001F, U+007F), whitespace (`\s`) or `\`.
3. `new URL(next, "http://x.invalid")` throws, its origin is not `http://x.invalid`, or its pathname does not start with `prefix + "/"`.
4. The pathname contains `//`.
5. `decodeURIComponent(pathname)` throws, or the decoded path contains a control character or `\`, or a `.` or `..` segment.
A module comment says it mirrors `safeNext` and must be kept in step with it.

### `example/oidc/allowlist.ts`
Added 2026-10-10 (Q21, decision 053 point 12).
```ts
export interface Allowlist { subjects: string[]; emailDomains: string[] }
export interface OidcIdentity { sub: string; email: string; emailVerified: boolean }
export function parseAllowlist(subjects: string | undefined, emailDomains: string | undefined): Allowlist;
export function isAllowed(identity: OidcIdentity, allow: Allowlist): boolean;
```
- `parseAllowlist`: each argument is split on `,`; entries are trimmed and empty ones dropped; subjects keep their case; domains are lowercased. `undefined` gives `[]`.
- `isAllowed` returns true when either holds, otherwise false:
  - `allow.subjects` contains `identity.sub` (exact, case-sensitive);
  - `identity.emailVerified` is true and the part of `identity.email` after its last `@`, lowercased, equals an entry of `allow.emailDomains` (exact: `sub.example.com` does not match `example.com`; an email without `@` or with nothing after it never matches).
- An empty allowlist (both lists empty) allows nobody. The domain rule needs `email_verified` because an IdP may let users set an unverified address in any domain (unverified as a general claim; the rule costs nothing when the IdP verifies).

### `example/oidc/mode.ts`
Added 2026-10-10 (design review, findings L1 and L5): the single source of the mode rule and of the TLS refusal, used by both `launch.ts` and `config.ts`.
```ts
export type OidcMode = "mock" | "real";
export function selectMode(env: Record<string, string | undefined>): OidcMode;
export function assertTlsVerificationOn(env: Record<string, string | undefined>): void;
```
- `selectMode`: `"real"` when `env.OIDC_ISSUER` is a non-empty string, otherwise `"mock"`.
- `assertTlsVerificationOn`: throws `Error("NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate verification; unset it to run this example.")` when `env.NODE_TLS_REJECT_UNAUTHORIZED === "0"` (the only value with which Node turns verification off). This file is the only place outside `test/tls-verification.test.ts` where that name may appear, exactly once, inside this check (decision 053 point 2; the guard test enforces the count).

### `example/oidc/config.ts`
Added 2026-10-10: the environment rules formerly listed under `server.ts`, as a pure function so they are unit-tested (Q21). Changed 2026-10-10 (design review): mode from `selectMode`; every library setting explicit (`Required<OidcAuthEnv>`), so no `OIDC_*` variable reaches the library through its `process.env` fallback; real-mode scopes default to `openid email`; exact error texts.
```ts
export interface OidcExampleConfig {
  mode: OidcMode;
  port: number;
  hostname: string;
  secret: string;                                    // ADMIN_SECRET or random
  mockCert: { dir: string; port: number } | null;    // mock mode only
  oidc: Omit<Required<OidcAuthEnv>, "OIDC_ISSUER">;  // every library key except the issuer
  issuer: string | null;                             // real mode: OIDC_ISSUER; mock mode: null (known after the IdP starts)
  allow: Allowlist;
  notes: string[];                                   // startup lines to print (unset secrets, mock hint)
}
export function readOidcExampleConfig(env: Record<string, string | undefined>): OidcExampleConfig;
```
Checks run in this order; the first failure throws `Error` with exactly the text given (values are never echoed). `server.ts` prints the message and exits 1.
1. `assertTlsVerificationOn(env)` (mode.ts).
2. `mode = selectMode(env)`.
3. Real mode with `env.OIDC_MOCK_CERT_DIR` set → `OIDC_MOCK_CERT_DIR is set by "pnpm example:oidc" for mock mode only; unset it when OIDC_ISSUER is set.`
4. Mock mode with `env.OIDC_MOCK_CERT_DIR` or `env.NODE_EXTRA_CA_CERTS` unset → `Mock mode needs the generated certificate: start it with "pnpm example:oidc", or set OIDC_ISSUER to use a real IdP.` (this is what running `server.ts` directly gives).
5. Real mode: for `OIDC_CLIENT_ID`, then `OIDC_CLIENT_SECRET`, unset or empty → `<NAME> is required when OIDC_ISSUER is set.`
6. `env.OIDC_AUTH_SECRET` set and shorter than 32 characters → `OIDC_AUTH_SECRET must be at least 32 characters.` (the library would otherwise answer 500 on every OIDC route). Unset → `randomBytes(32).toString("hex")`.
7. `redirectUri = env.OIDC_REDIRECT_URI ?? "http://localhost:" + port + "/oidc/callback"`; when `new URL(redirectUri)` throws, its protocol is not `http:` / `https:`, or its pathname is not `/oidc/callback` → `OIDC_REDIRECT_URI must be an absolute http or https URL whose path is /oidc/callback.`
8. `allow = parseAllowlist(env.OIDC_ALLOWED_SUBJECTS, env.OIDC_ALLOWED_EMAIL_DOMAINS)`. Real mode with an empty `allow` → `OIDC_ALLOWED_SUBJECTS or OIDC_ALLOWED_EMAIL_DOMAINS must list at least one entry when OIDC_ISSUER is set.` (refuse to start, decision 053 point 12). Mock mode with an empty `allow` → `{ subjects: ["demo"], emailDomains: [] }` (the demo user; any other user name shows the 403 page).
Values:
- `port = Number(env.PORT ?? 3000)`, `hostname = env.HOST || "127.0.0.1"`, `secret = env.ADMIN_SECRET ?? randomBytes(32).toString("hex")`.
- `mockCert = { dir: env.OIDC_MOCK_CERT_DIR, port: Number(env.OIDC_MOCK_PORT ?? 3001) }` in mock mode, else `null`; `issuer = env.OIDC_ISSUER` in real mode, else `null`.
- `oidc` (all keys, so `@hono/oidc-auth` never falls back to `process.env`; its `??` fallback applies only to `undefined`, and an empty string means "not set" for the three optional URL/domain keys, evidence: 2026-10-09-oidc-example-package-types): `OIDC_AUTH_SECRET`, `OIDC_REDIRECT_URI: redirectUri`, `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` (mock: `"drizzle-admin-example"` / `"example-only-secret"`; real: from `env`), `OIDC_SCOPES` (mock: `"openid email offline_access"`; real: `env.OIDC_SCOPES || "openid email"`), `OIDC_AUDIENCE` (real: `env.OIDC_AUDIENCE ?? ""`; mock: `""`), and the fixed values `OIDC_AUTH_REFRESH_INTERVAL: "900"`, `OIDC_AUTH_EXPIRES: "86400"`, `OIDC_COOKIE_NAME: "oidc-auth"`, `OIDC_COOKIE_PATH: "/"`, `OIDC_COOKIE_DOMAIN: ""`, `OIDC_AUTH_EXTERNAL_URL: ""`, `OIDC_JWT_ALG: "HS256"` (the library defaults, made explicit). No other `OIDC_*` variable has any effect.
- `notes`: `Note: ADMIN_SECRET is not set; admin sessions will not survive a restart.` and `Note: OIDC_AUTH_SECRET is not set; sign-ins will not survive a restart.` when unset; in mock mode with the default allowlist `Sign in at the mock IdP as "demo" (other names are refused); the browser warns about its certificate.`
- Real-mode scopes: `openid email` is all the example reads (`sub`, `email`, `email_verified`). Without `offline_access` there is no refresh token, so the session ends after the 15-minute refresh interval and the next admin request goes through the IdP again (usually without a prompt while the IdP session lasts). `OIDC_SCOPES` overrides it, e.g. `OIDC_SCOPES="openid email offline_access"` when the IdP supports it; every listed scope must be in the IdP's `scopes_supported` (evidence: 2026-10-09-hono-oidc-auth-package).

### `example/oidc/app.tsx`
Changed 2026-10-10: `allow` option, claims hook for `email_verified`, 403 page from the login route and the bridge (Q21).
```ts
export async function createOidcExampleApp(opts: {
  secret: string;                    // admin secret, >= 32 chars
  oidc: Required<OidcAuthEnv>;       // from "@hono/oidc-auth"; every key, so process.env is never consulted
  allow: Allowlist;                  // empty = nobody gets in
}): Promise<{ app: Hono; admin: Admin }>;
```
Builds, in this order:
1. `const users = new WeakMap<Request, AdminUser>()` (per call; no module state).
2. `admin = await createExampleAdmin({ secret, auth: { getUser: async (req) => users.get(req) ?? null, loginUrl: "/oidc/login" } })`.
3. `app.use("*", initOidcAuthMiddleware(opts.oidc))`: configures the library once per request (configuring twice throws, evidence: 2026-10-09-hono-oidc-auth-package). Changed 2026-10-10 (design review, L4): `opts.oidc` carries every key, so the library's per-key `process.env` fallback never applies and a developer's shell cannot change the app.
4. `app.use("*", (c, next) => { c.set("oidcClaimsHook", claimsHook); return next(); })`. `claimsHook(orig, claims)` (module-private) returns `{ sub: claims?.sub || orig?.sub || "", email: claims?.email || orig?.email || "", email_verified: claims?.email ? claims.email_verified === true : orig?.email_verified === true }`: the library's default hook plus `email_verified`, which follows whichever email is kept (evidence: 2026-10-09-oidc-example-package-types).
5. `identityOf(auth)` (module-private): `null` when `auth` is `null` or `auth.sub` is not a non-empty string (`sub` is optional in the library's type); otherwise `{ sub, email: typeof auth.email === "string" ? auth.email : "", emailVerified: auth.email_verified === true }`. The admin user is `{ id: sub, name: email || sub }`.
6. Bridge: `app.use("/admin/*", ...)`: `id = identityOf(await getAuth(c))`; no `id` → `next()` (the admin redirects to login); `id` allowed (`isAllowed(id, opts.allow)`) → `users.set(c.req.raw, user)` then `next()`; otherwise return the 403 page without calling `next`. A cookie that `getAuth` re-sets during a refresh reaches the admin's response (evidence: 2026-10-09-oidc-example-runtime-checks; the refresh itself is not run in tests).
7. `app.route("/admin", admin.app)`: the mount is what makes `c.req.raw` the same object inside the admin (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e). The bridge must be registered before the mount.
8. `app.get("/oidc/login", oidcAuthMiddleware(), handler)`: `id = identityOf(await getAuth(c))`; allowed → `c.redirect(safeReturnPath(c.req.query("next"), "/admin"), 302)`; otherwise the 403 page (after `oidcAuthMiddleware` a session always exists here).
9. `app.get("/oidc/callback", ...)`. Changed 2026-10-10 (design review, L2): `try { return await processOAuthCallback(c); } catch (error) { ... }`. The library throws an `HTTPException(500)` whose message contains the IdP's `error` and `error_description` (for example when the user cancels consent, `error=access_denied`), and other errors for a failed state, nonce or PKCE check, missing cookies or an unreachable IdP; Hono's default handler would send that message as the body (evidence: 2026-10-09-oidc-example-package-types). On any error the handler: deletes the `state`, `nonce`, `code_verifier` and `continue` cookies with `deleteCookie(c, name, { path: "/oidc/callback", secure: true })` (the library sets them with the redirect URI's path and deletes only some before it throws); logs one line `console.error("drizzle-admin OIDC example: sign-in callback failed:", error instanceof Error ? error.name : "unknown error")` (the name only, no message, so no IdP text or token reaches the log); and returns `c.html(<SignInFailedPage />, 400)`: `<h1>Sign-in failed</h1>`, `<p>The sign-in could not be completed.</p>`, `<a href="/admin/">Try again</a>`. Nothing from the request or the error is rendered.
10. `app.post("/oidc/logout", csrf(), async (c) => { await revokeSession(c); return c.redirect("/", 303); })` with `csrf` from `hono/csrf` (default: `Origin` must equal the request URL origin for form posts).
11. `app.get("/", ...)`: `identityOf(await getAuth(c))`; signed in → `<p>Signed in as {name}</p>`, `<a href="/admin/">Open the admin</a>` and the sign-out form; signed out → `<a href="/admin/">Sign in</a>`.
- Pages: Hono JSX (escaped), minimal English, `<title>drizzle-admin OIDC demo</title>`, no CSS, no script. Sign-out form: `<form method="post" action="/oidc/logout"><button type="submit">Sign out</button></form>`. 403 page (`c.html(..., 403)`, module-private component): `<h1>Access denied</h1>`, `<p>{name} is not allowed to use this admin.</p>`, `<p>Ask an administrator to add your account to OIDC_ALLOWED_SUBJECTS or OIDC_ALLOWED_EMAIL_DOMAINS, or sign in with another account.</p>` and the sign-out form. The session is not revoked automatically, so the page can name the account; signing out lets the user try another one (at the mock IdP the IdP session survives, so another name needs a new browser session; README says so).
Routes other than these and `/admin/*` get Hono's default 404.

### `example/oidc/server.ts` (child process; not unit-tested, like `example/server.ts`)
Changed 2026-10-10: the environment rules moved to `config.ts`; the issuer is merged here (design review).
- `config = readOidcExampleConfig(process.env)`; on an `Error`, print its message and `process.exit(1)`.
- Mock mode: `idp = await startMockIdp({ ...readLocalhostCert(config.mockCert.dir), port: config.mockCert.port, clientId: config.oidc.OIDC_CLIENT_ID, clientSecret: config.oidc.OIDC_CLIENT_SECRET, redirectUris: [config.oidc.OIDC_REDIRECT_URI] })`; `issuer = idp.issuer`. Real mode: `issuer = config.issuer`. (`mockCert` / `issuer` are non-null in their mode; a non-null assertion with a short comment.)
- `const { app } = await createOidcExampleApp({ secret: config.secret, oidc: { ...config.oidc, OIDC_ISSUER: issuer }, allow: config.allow })`; `root = new Hono(); root.use("*", hostGuard(config.hostname, config.port)); root.route("/", app)`; `serve({ fetch: root.fetch, port, hostname })`. `hostGuard` (decision 048) also limits the Host from which the library builds `continue`.
- Prints `drizzle-admin OIDC demo: http://localhost:<port>/admin/`, in mock mode `Mock IdP: <issuer>`, then each of `config.notes`.

### `example/oidc/launch.ts` (`pnpm example:oidc`)
Changed 2026-10-10 (design review, L1 and L5): the launcher uses `mode.ts`, so it and `config.ts` cannot disagree on the mode.
- First `assertTlsVerificationOn(process.env)`; on an `Error`, print its message and exit 1 before anything is generated or spawned.
- `serverPath = fileURLToPath(new URL("./server.ts", import.meta.url))`.
- `selectMode(process.env) === "real"`: `env = process.env`, no directory.
- `"mock"`: `{ dir, certPath } = await writeLocalhostCert()`; `env = { ...process.env, NODE_EXTRA_CA_CERTS: certPath, OIDC_MOCK_CERT_DIR: dir }` (an existing `NODE_EXTRA_CA_CERTS` is replaced for the child only).
- `child = spawn(process.execPath, ["--import", "tsx", serverPath], { stdio: "inherit", env })` (argument array, no shell; `--import tsx` resolves from the repo root, evidence: 2026-10-09-oidc-example-runtime-checks).
- On `SIGINT` / `SIGTERM` the launcher calls `child.kill(signal)` and keeps waiting. On the child's `exit`, it removes `dir` (mock mode) and exits with the child's code, or 1 when the child ended by a signal. A `spawn` error also removes `dir` and exits 1.

## Configuration (environment)
Changed 2026-10-10: allowlist variables (Q21). Changed 2026-10-10 (design review): `OIDC_SCOPES` and `OIDC_AUDIENCE` rows; other `OIDC_*` variables are ignored.
| Variable | Mode | Default | Meaning |
|---|---|---|---|
| `PORT` / `HOST` | both | `3000` / `127.0.0.1` | app listen address, as in `pnpm example` |
| `ADMIN_SECRET` | both | random per start | `createAdmin` secret |
| `OIDC_AUTH_SECRET` | both | random per start | `@hono/oidc-auth` session signing key, at least 32 characters |
| `OIDC_REDIRECT_URI` | both | `http://localhost:<PORT>/oidc/callback` | must have the path `/oidc/callback`; register it at the IdP |
| `OIDC_ALLOWED_SUBJECTS` | both | mock: `demo`; real: required unless the next is set | comma-separated `sub` values allowed into the admin |
| `OIDC_ALLOWED_EMAIL_DOMAINS` | both | none | comma-separated email domains allowed (exact domain, `email_verified` must be true) |
| `OIDC_MOCK_PORT` | mock | `3001` | mock IdP port |
| `OIDC_ISSUER` | real | unset | setting it selects real mode |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | real | required | client registered at the IdP |
| `OIDC_SCOPES` | real | `openid email` | space-separated scopes; each must be in the IdP's `scopes_supported`; add `offline_access` for sessions longer than 15 minutes (mock mode always uses `openid email offline_access`) |
| `OIDC_AUDIENCE` | real | none | passed as `audience` on the authorization request (some IdPs need it) |
`OIDC_MOCK_CERT_DIR` and `NODE_EXTRA_CA_CERTS` are set by the launcher, not by the user. Any other `OIDC_*` variable (for example `OIDC_COOKIE_PATH`) has no effect: the example passes every library setting itself. With certificate verification disabled in the environment, both the launcher and the server refuse to start. With a real IdP and neither allowlist variable set (or only empty entries), the example refuses to start.

## README text (section "Development", new subsection "OIDC example", before "Changelog")
Changed 2026-10-10: allowlist, demo user `demo`, user check (Q19, Q21).
Changed 2026-10-10 (design review): item 2 states the real-mode scopes and that other `OIDC_*` variables are ignored; item 3 warns about other mount styles; the TLS caveat names the refusal.
Content, in this order:
1. `pnpm example:oidc` starts the same demo with sign-in through OpenID Connect (`@hono/oidc-auth`, external auth mode with `auth.getUser` and `auth.loginUrl`). Without `OIDC_ISSUER` it also starts a local mock IdP (`oidc-provider`) on `https://localhost:3001` with a certificate generated at start and trusted by the Node process through `NODE_EXTRA_CA_CERTS`; nothing needs network access. Open `http://localhost:3000/admin/` (use `localhost`, not `127.0.0.1`) and sign in as `demo`; any other user name shows the "Access denied" page. `/` shows the signed-in user and a "Sign out" button.
2. Real IdP: set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, at least one of `OIDC_ALLOWED_SUBJECTS` / `OIDC_ALLOWED_EMAIL_DOMAINS` (otherwise it refuses to start), and register `http://localhost:3000/oidc/callback` (or `OIDC_REDIRECT_URI`) as a redirect URI; then no mock and no extra CA are used. The variables table above, minus the launcher-only ones. In real mode the example requests only `openid email`; set `OIDC_SCOPES` (for example `"openid email offline_access"`) to change that. Other `OIDC_*` variables of `@hono/oidc-auth` are ignored, because the example passes every setting itself. The email-domain rule needs `email` and `email_verified` in the ID token; if the IdP puts them only in userinfo, use subjects.
3. How it fits together: the `/admin/*` middleware reads the session with `getAuth(c)`, checks the allowlist, and hands the user to `getUser` through a `WeakMap` keyed by the request, which works because the admin is mounted with `app.route` and sees the same `Request`; the login route validates `next` itself, because `@hono/oidc-auth` returns to the URL stored in its `continue` cookie without validating it. If you copy this, keep the bridge before an `app.route("/admin", admin.app)` mount: with `app.mount`, a separate `admin.fetch` call or the bridge registered after the mount, the admin sees a different `Request`, `getUser` returns `null` even for an allowed user, and the browser loops between `/admin/` and `/oidc/login`.
4. Caveats:
   - Example code, not a hardened production configuration: every allowlisted user gets full admin access (no per-user permissions).
   - On a manual run the browser warns about the mock IdP's certificate once per start (it is trusted only by Node).
   - Safari may not store `Secure` cookies set by `http://localhost` (WebKit bugs 232088 and 231035), so sign-in may loop there; use Chrome or Firefox.
   - The `@hono/oidc-auth` session cookie (`oidc-auth`) is a signed, not encrypted, JWT that contains the refresh token; it is always `Secure` and has no `SameSite` attribute. `OIDC_AUTH_SECRET` must be at least 32 characters.
   - "Sign out" deletes the app's session and revokes the refresh token when the IdP supports revocation, but does not end the session at the IdP (to switch users at the mock IdP, use a new private window).
   - TLS certificate verification is never turned off; trust comes only from the generated certificate passed as an extra CA, and the example refuses to start when the environment disables verification.

## Errors
Changed 2026-10-10: empty allowlist with a real IdP; 403 for users not allowed (Q21). Changed 2026-10-10 (design review): exact startup texts in `config.ts` / `mode.ts`; callback failures.
- Startup: the messages listed in `mode.ts` and `config.ts`, printed as one line, exit 1; a port in use surfaces as the thrown error.
- A signed-in user not on the allowlist: 403 "Access denied" page from `/oidc/login` and from every `/admin/*` path; the admin app never sees the user.
- `GET /oidc/callback` failing for any reason (IdP error such as `access_denied`, state / nonce / PKCE mismatch, missing or expired flow cookies, token request failure): 400 "Sign-in failed" page, flow cookies deleted, only the error's name logged.
- Other request-time errors (for example `getAuth` failing during a refresh, or library misconfiguration on `/oidc/login`) reach Hono's default handler (500). No retry (example scope).
