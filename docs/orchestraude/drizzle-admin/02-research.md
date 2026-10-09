# Research: drizzle-admin

## Relevant existing code
- The repository is greenfield. Tracked/present files: `mise.toml` (`node = "24.21.0"`), `docs/pre-specs.md` (the spec, source of the target layout in §4), `docs/orchestraude/`. No `package.json`, `src/`, `test/`, `example/`, `CLAUDE.md`, LICENSE or README exist. Git has no commits.
- No project-level `CLAUDE.md`; only the user's global one (conventional commits in English, code comments in English explaining why, no commits unless asked).
- `pnpm` is not installed on this machine; corepack 0.36.0 ships with the mise Node (evidence: 2026-10-07-toolchain-versions).

## Existing conventions and patterns
- Target layout, naming, test location (`test/`), and example app (`example/schema.ts`, `seed.ts`, `server.ts`) are defined only by pre-spec §4.
- Record keeping: decisions in `docs/orchestraude/decisions/` (currently empty), not `NOTES.md` (requirements override §14).
- Pre-spec §3 pins Drizzle internals to `src/introspect/`; `any` allowed only at Drizzle boundary (`src/introspect/`, `src/data/`) with a reason comment.

## External dependencies and their behavior
### drizzle-orm
- Latest stable line is 0.45.x (`latest` = 0.45.3, published 2026-09-21). 1.0.0 is only beta (`beta` = 1.0.0-beta.22) and rc (`rc` = 1.0.0-rc.4; rc.5 builds exist) tags. Per requirements, the supported peer range is therefore the 0.45 line; the exact peer range expression is a design decision (evidence: 2026-10-07-drizzle-orm-release-lines).
- All database drivers are optional peers of drizzle-orm (better-sqlite3 >=7, @electric-sql/pglite >=0.2.0) (evidence: 2026-10-07-drizzle-orm-release-lines).
- Column properties confirmed at runtime on 0.45.3: `name, dataType, columnType, notNull, hasDefault, primary, enumValues`, plus `mode` for some SQLite columns (evidence: 2026-10-07-drizzle-column-introspection).
- SQLite mapping: `integer({mode:'boolean'})` -> dataType `boolean`; `integer({mode:'timestamp'|'timestamp_ms'})` -> dataType `date`, `mode` tells which; `text({mode:'json'})` -> `json`; `text({enum})` -> `string` with `enumValues`; autoincrement pk has `hasDefault` true (evidence: 2026-10-07-drizzle-column-introspection).
- PG mapping: `serial` -> number, notNull+hasDefault+primary; pgEnum -> `string` with `enumValues`; `timestamp` -> date; `jsonb` -> json; `text` and `varchar` both dataType `string` (distinguish by `columnType` PgText/PgVarchar for the textarea rule); `bigint({mode:'bigint'})` -> bigint; `uuid` -> string (hasDefault with defaultRandom); `date()` -> dataType `string` (PgDateString), so it will not be detected as `date` kind from dataType alone; identity integer -> hasDefault true (evidence: 2026-10-07-drizzle-column-introspection).
- Composite PKs are visible in `getTableConfig(t).primaryKeys`; member columns do not have `primary` true. FKs via `getTableConfig(t).foreignKeys[i].reference().foreignColumns` (evidence: 2026-10-07-drizzle-column-introspection). Column property `primary` alone therefore cannot detect composite keys.
- Other PG types (numeric, interval, arrays, etc.), SQLite blob/bigint modes, `ilike`/`like` generated SQL, and `.returning()` on the two drivers: unverified (spec asserts returning works on both).
- Drizzle 1.0 Column API differences: unverified (not checked).

### hono
- `hono/csrf` (4.13.13) guards only unsafe methods with form content types (urlencoded, multipart, text/plain; missing Content-Type treated as text/plain). It passes if Sec-Fetch-Site is `same-origin` OR Origin equals the URL origin; neither header present -> 403. Default origin comes from `c.req.url`, so reverse proxies may need the `origin` option. This is slightly different from the spec's "verify the Origin" (evidence: 2026-10-07-hono-csrf-and-jsx).
- `hono/jsx` escapes text and attribute values (runtime probe); `String(element)` gives HTML. tsconfig needs `jsx: react-jsx`, `jsxImportSource: hono/jsx` (evidence: 2026-10-07-hono-csrf-and-jsx).
- Hono JSX in a published package: whether consumers' tsconfig affects the built output depends on the build tool; unverified.

### Toolchain (npm latest on 2026-10-07)
- hono 4.13.13, zod 4.6.5, vitest 5.0.3 (node ^22.12||^24||>=26), better-sqlite3 13.0.3 (node >=22, prebuilt binary worked on Node 24.21.0), @electric-sql/pglite 0.5.8, typescript 7.0.2, parse5 8.0.1, tsup 8.5.1, tsdown 0.23.0, eslint 10.12.0, @biomejs/biome 2.5.15, @hono/node-server 2.1.3, tsx 4.23.15, pnpm 12.9.1 (evidence: 2026-10-07-toolchain-versions).
- Unverified: compatibility among these (vitest 5 with TS 7, build tools with TS 7 and `.d.ts` emission, zod 4 vs the spec's schema generation), PGlite with drizzle 0.45.3 at runtime (import path `drizzle-orm/pglite` not exercised), and pnpm 12 default handling of dependency build scripts.

## Risks and constraints that affect the design
- Spec says "pin the installed version" while requirements say peerDependency range plus an exact-pinned dev dependency; drizzle 0.45.x is the only stable line, 1.0 is imminent-looking (rc) and may break introspection. Isolation in `src/introspect/` is the mitigation.
- PG `date()` is dataType `string`, and text vs varchar needs `columnType`; the spec's "kind from dataType" needs `columnType`/`mode` refinements (listed above).
- Composite-PK rejection must use `getTableConfig().primaryKeys`, not `column.primary`.
- `hono/csrf` allows requests with matching Sec-Fetch-Site even without Origin; the §10 test "CSRF 403" must also send the missing hidden token case; app.request() in tests sends neither header, so tests must set Origin explicitly.
- pnpm must be provisioned (corepack or mise) before `pnpm test/typecheck/lint/build`; no lint tool exists yet (design chooses).
- Tooling versions are very new (TS 7, vitest 5, pnpm 12); compatibility is unverified and should be proven in phase 1 setup.
- Spec §10 sessions are limited to user info, CSRF token, issue time; `getUser` external auth has no session cookie, so CSRF token source for that mode is unspecified (ambiguity to raise with the user; not resolved here).
- Spec §5.2 `AdminConfig.db: unknown` and `AdminAction.run` `ctx.db: unknown`, with `admin.fetch` not specified in §5.2 types; typing of `db` across sqlite and pg drivers is a design matter.

## Evidence referenced
- 2026-10-07-drizzle-orm-release-lines
- 2026-10-07-drizzle-column-introspection
- 2026-10-07-hono-csrf-and-jsx
- 2026-10-07-toolchain-versions

## Post-v1: Digital Agency design system

Scope (user, narrowed): make the existing UI feel closer to DADS (look and feel). Keep our own markup, selectors, single stylesheet (`src/static/admin-css.ts`), inline SVG icons (decision 039), `prefers-color-scheme` dark mode, no external fonts, no JS. Not adopting DADS components, class names, or JS.

### License and attribution
- Snippets repo and `@digital-go-jp/design-tokens` are MIT (Copyright Digital Agency); copying their CSS/tokens into an MIT package is permitted if the MIT notice is kept when copied substantially (evidence: 2026-10-08-dads-license-notices).
- The notices page says edited/processed snippet-derived UI used on the user's own site needs no attribution; only unmodified published use requires a citation. Guidelines text itself (design system body) requires a source credit, and processed content must not appear to be made by the Digital Agency (evidence: 2026-10-08-dads-license-notices).
- Color hex, px sizes and ratios are plain values; writing our own CSS "inspired by" them copies no code. Whether bare values are copyrightable is a legal question, not answered (unverified). Safe course: write our own CSS using the values; if any CSS block is pasted verbatim, add the MIT notice to the package's third-party notices. Do not use DA logos/branding.
- Font: Noto Sans is OFL 1.1; bundling would need the license text and font must not be sold alone (evidence: 2026-10-08-dads-license-notices). Irrelevant if we do not ship the font.

### Traits that give the DADS feel (all values from evidence: 2026-10-08-dads-design-tokens-package, 2026-10-08-dads-html-snippets-repo)
- Primary (key) blue: blue-900 #0017c1 (buttons, links; hover blue-1000 #00118f, active blue-1200 #000060); tints blue-50 #e8f1fe, -100 #d9e6ff, -200 #c5d7fb, -300 #9db7f9. Links: blue-1000 underlined (1px, 3px on hover, offset 3px); visited magenta-900 #8b008b; active orange-800 #c74700.
- Neutrals: text gray-800 #333333, strong text gray-900 #1a1a1a, input border gray-600 #666666, table border/disabled gray-420 #949494, muted gray-536 #767676, disabled bg gray-50 #f2f2f2, gray-100 #e6e6e6, gray-300 #b3b3b3; white page/background.
- Semantic: error red-800 #ec0000 (hover/dark red-900 #ce0000, red-1000 #a90000); success green-800 #197a4b (green-600 #259d63); warning yellow-900 #927200 with chip yellow-400 #ffc700; orange-800 #c74700; info blue-900 or gray-536.
- Typography: Noto Sans JP, weights 400/700 only; body 16px, line-height 1.7, letter-spacing 0.02em; dense/table 14-16px, line-height 1.2-1.3; headings bold, 1.5 line-height, sizes 20/22/24/26/28/32/36px (letter-spacing 0.02em up to 20-26px, 0.01em at 28-36px); page text is larger and airier than our current 14px.
- Radius: 4, 6, 8 (buttons/inputs), 12 (notifications), 16 px. Elevation shadows exist (e.g. `0 2px 8px 1px rgba(0,0,0,.1), 0 1px 5px rgba(0,0,0,.3)`), used sparingly; the look is flat with strong borders.
- Spacing: no spacing tokens; components use a 4px-based set: 4, 8, 12, 16, 20, 24, 32 px. Control heights: input 40/48/56, button 28/36/48/56 px; min touch area 44px.
- Focus ring: 4px solid black outline, 2px offset, 4px radius, plus 2px #ffd43d (yellow-300) halo; text buttons also fill yellow (evidence: 2026-10-08-dads-a11y-focus-contrast).
- Buttons: solid fill (blue-900, white bold text, 4px double transparent border, underline on hover), outline (1px currentcolor border, white bg, blue text; hover bg blue-200), text (underlined, no border). Radius 8px at md/lg. No red/danger variant exists in DADS snippets, so destructive styling must be our own (e.g. red-800/900 with the same shape) (unverified fit; not in DADS).
- Inputs: white bg, 1px gray-600 border, 8px radius, 16px text, black border on hover, invalid = red-800 border plus red error text below; read-only = dashed border; labels with a "※必須" requirement marker.
- Tables: borderless-ish, 1px gray-420 row dividers, cell padding 20/16px (dense 12/16px), bold header cells, optional zebra stripe; no heavy header fill.
- Notifications: white card, 3px border in semantic color, 12px radius, left-aligned semantic icon (24-44px), bold 17px heading; color-chip variant has a thick left inset bar (8px mobile, 16px desktop).
- Contrast of these pairs on white: blue-900 11.1:1, red-800 4.6, red-900 5.79, green-800 5.35, yellow-900 4.54, gray-600 5.74, gray-800 12.63; gray-420 borders are only 3.03:1 (OK for non-text 3:1) (evidence: 2026-10-08-dads-a11y-focus-contrast).

### Fonts
- DADS declares `'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif` and its examples load Noto Sans JP from Google Fonts; there is no self-hosted file and no official system fallback beyond that (evidence: 2026-10-08-dads-html-snippets-repo, 2026-10-08-dads-design-tokens-package). Requirement §11 forbids external fonts, so we can only reference `"Noto Sans JP"` as a locally installed name and must keep our system-ui stack with Japanese system fonts (e.g. "Hiragino Sans", "Yu Gothic", Meiryo) as the effective face; exact stack is a design decision. Glyph metrics differ from Noto Sans JP, so line-height 1.7 may need review (unverified).

### Dark mode
- DADS defines no dark-mode colors: no dark tokens in the tokens package, no `prefers-color-scheme` in the snippets (only `color-scheme` on modal backdrops) (evidence: 2026-10-08-dads-design-tokens-package). The website guideline pages were not checked for a written policy (unverified). We must derive our own dark palette: e.g. keep the same hue family, use light tints (blue-200/300) for links and primary, red-300/400 for errors, and verify contrast ourselves; the DADS yellow/black focus ring needs a dark-mode variant.

### Risks and constraints
- DADS is beta (site v2.18.0, snippets tagged weekly), so values may drift; copying values freezes a snapshot (evidence: 2026-10-08-dads-html-snippets-repo).
- Their palette is light-only; blue-900 on dark backgrounds fails contrast, so our dark mode is original work.
- Larger text (16px/1.7) and 40-48px controls enlarge tables/forms; interacts with the <768px responsive rules and the density of list/tables.
- Underlined links and black+yellow focus ring change the visual identity noticeably; decision 039 icons use stroke-based inline SVG and are unaffected, but icon colors need re-checking against the new palette (3:1).
- No DADS red button, sidebar, header, or numbered pagination exists to copy; those parts follow our own design.

### Evidence referenced
- 2026-10-08-dads-license-notices
- 2026-10-08-dads-html-snippets-repo
- 2026-10-08-dads-design-tokens-package
- 2026-10-08-dads-a11y-focus-contrast
- 2026-10-08-dads-icon-terms (icons: DADS has no icon font/sprite; its inline SVGs use `currentcolor` and `aria-hidden`, matching decision 039; Figma icons are partly Material Symbols, Apache 2.0)

## OIDC example (2026-10-09)

Scope: facts for an OIDC SSO example using external auth mode (`auth.getUser` + `auth.loginUrl`, decisions 044 and 047) with `@hono/oidc-auth`, a local mock IdP and a vitest flow test. No design here. Experiments ran in a scratch directory (Node v24.21.0, hono 4.13.13, vitest 5.0.3), not in this repo.

### Repo facts that bear on it
- `getUser` is typed `(req: Request) => Promise<AdminUser | null>` and is called with `c.req.raw` (`src/types.ts:26`, `src/routes/middleware.ts:78`). `@hono/oidc-auth`'s `getAuth(c)` needs a Hono Context, not a Request (evidence: 2026-10-09-hono-oidc-auth-package). A sub-app mounted with `app.route` receives the same `Request` object as the outer middleware (checked) (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e).
- Repo pins `hono` 4.13.13 and `@hono/node-server` 2.1.3 as devDependencies, engines node >=22, mise Node 24.21.0 (`package.json`, `mise.toml`).

### 1. @hono/oidc-auth 1.10.0
- Latest stable 1.10.0 (2026-08-05), MIT, node >=18, peer `hono >=3.0.0` (satisfied by 4.13.13), sole dependency `oauth4webapi ^3.8.6` (3.8.8 resolved, MIT) (evidence: 2026-10-09-hono-oidc-auth-package).
- API: `oidcAuthMiddleware`, `getAuth`, `processOAuthCallback`, `revokeSession`, `initOidcAuthMiddleware`, `getAuthorizationServer`, `getClient`, `setClient`, `setClientAuth`; context hooks `oidcClaimsHook`, `oidcAuthRefreshErrorHook` (evidence: 2026-10-09-hono-oidc-auth-package).
- Config: `OIDC_AUTH_SECRET` (>=32 chars), `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` (default `/callback`, path or full URL), `OIDC_SCOPES` (default: all of the IdP's `scopes_supported`; each must be supported), `OIDC_AUTH_REFRESH_INTERVAL` (900 s), `OIDC_AUTH_EXPIRES` (86400 s), `OIDC_COOKIE_NAME/PATH/DOMAIN`, `OIDC_AUDIENCE`, `OIDC_AUTH_EXTERNAL_URL`, `OIDC_JWT_ALG` (HS256). Values come from `initOidcAuthMiddleware({...})` first, else `hono/adapter` `env(c)`, which is `process.env` on Node and `c.env` on workerd. Configuring the same context twice throws 500 (evidence: 2026-10-09-hono-oidc-auth-package). In vitest, `initOidcAuthMiddleware({...})` per app worked (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e).
- Session cookie `oidc-auth`: HS256-signed JWT (signed, not encrypted) holding `sub`, `email`, `rtk` (the refresh token, readable by the browser user), `rtkexp`, `ssnexp`. Attributes: `Path=/`, `HttpOnly`, `Secure` always, no `SameSite`, no expiry (session cookie). Extra claims via `oidcClaimsHook` (evidence: 2026-10-09-hono-oidc-auth-package).
- Flow security: state, nonce and PKCE S256 are generated and held in cookies (`state`, `nonce`, `code_verifier`, `continue`; `Path=<redirect path>`, `HttpOnly`, `Secure`) and checked at the callback (evidence: 2026-10-09-hono-oidc-auth-package).
- Scopes: with no `OIDC_SCOPES` it requests every `scopes_supported`; it throws 500 if the IdP publishes no `scopes_supported` (evidence: 2026-10-09-hono-oidc-auth-package). `email` in the session is empty unless the ID token carries it (observed with oidc-provider defaults) (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e).
- Return to original URL: the `continue` cookie holds the full URL of the request that reached `oidcAuthMiddleware` (or `OIDC_AUTH_EXTERNAL_URL` + path/query); the callback redirects there, or to `/`. Not configurable and not validated. Verified pattern: put `oidcAuthMiddleware()` on a login route, so `continue` = `/login?next=...`; after the callback the route handler sees the authenticated user and can redirect to a validated `next` (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e).
- Logout: `revokeSession(c)` deletes the cookie and revokes the refresh token only if the IdP advertises `revocation_endpoint`; no RP-initiated logout (`end_session_endpoint` unused), so the IdP's own session survives: the next login skipped the login prompt (oidc-provider still showed consent) (evidence: 2026-10-09-hono-oidc-auth-package, 2026-10-09-oidc-provider-mock-idp).
- Refresh: after `rtkexp`, `getAuth` uses the refresh token; with an empty `rtk` the cookie is deleted and login restarts. A 2.1 s wait with a 1 s interval stayed authenticated (rotation not inspected) (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e).
- Caching: AS metadata and client live on the Hono context only (per request), no module-level cache, so discovery is fetched on login redirect, callback, refresh and revoke, not on every authenticated request; tests need no cache reset (evidence: 2026-10-09-hono-oidc-auth-package).
- After `next()`, `oidcAuthMiddleware` overwrites `Cache-Control` with `private, no-cache` and re-sets the session cookie (evidence: 2026-10-09-hono-oidc-auth-package).

### 3. http://localhost issuer: NOT accepted
- `oauth4webapi` rejects non-HTTPS discovery and endpoint requests unless `allowInsecureRequests` is passed; no localhost exemption; `@hono/oidc-auth` 1.10.0 does not pass it and has no setting. Observed: `OAUTH_HTTP_REQUEST_FORBIDDEN`, surfaced by the app as 500 "Invalid session" (the real cause is swallowed) (evidence: 2026-10-09-oidc-auth-http-issuer).
- Working setup observed: IdP over `https://localhost:PORT` with a self-signed certificate (openssl, SAN localhost) and `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` set at runtime before the first fetch; app and its `OIDC_REDIRECT_URI` stay `http://localhost:PORT`. Works in plain Node and inside vitest (evidence: 2026-10-09-oidc-auth-http-issuer, 2026-10-09-oidc-auth-oidc-provider-e2e).
- Consequences to weigh: a committed or generated certificate is needed (Node has no built-in certificate minting, unverified); a real browser will warn about a self-signed IdP unless trusted (mkcert) (unverified); `NODE_EXTRA_CA_CERTS` must be set at process start (not tried); pre-seeding `oidcAuthorizationServer` does not remove the HTTPS check on the token endpoint (source reading, not run).

### 2. Mock IdP candidates
- **oidc-provider 9.12.2** (panva): MIT, ESM, deps koa ^3.2.1, jose ^6.2.10, debug (about 45 packages in the tree, 1.1 MB itself), no `engines` but warns unless Node LTS >= 22; no bundled `.d.ts` (`@types` not checked). `new Provider("http://localhost:PORT", {clients:[...], findAccount, ...})` works with an http issuer; construction about 5 ms; `provider.listen(port)` or `createServer(provider.callback())` (https possible) (evidence: 2026-10-09-oidc-provider-mock-idp).
- Dev login: `features.devInteractions` (default on, prints warnings) renders login and consent pages; `POST /interaction/:uid` with form fields `prompt=login&login=<accountId>` (password ignored), then `prompt=consent`. Whole flow driven by `fetch` with `redirect: "manual"` and a manual cookie jar: `/auth` 303, `/interaction/<uid>` (cookies `_interaction`, `_interaction_resume`, `_session`), login POST, consent POST, `redirect_uri?code&state&iss`. The consent POST goes to the first uid path, the consent page is under a new uid (evidence: 2026-10-09-oidc-provider-mock-idp, 2026-10-09-oidc-auth-oidc-provider-e2e).
- Needed config for `@hono/oidc-auth`: explicit `scopes` (include `openid`, `email`, `offline_access`), `issueRefreshToken` returning true (otherwise `rtk` is empty), `features.revocation.enabled` for token revocation, `conformIdTokenClaims: false` to get `email` into the ID token (evidence: 2026-10-09-oidc-provider-mock-idp, 2026-10-09-oidc-auth-oidc-provider-e2e).
- Full flow in one vitest test (provider + app + fetch driver): 276 ms total wall time, 1 test (evidence: 2026-10-09-oidc-auth-oidc-provider-e2e).
- **oauth2-mock-server 9.2.0**: MIT, node ^22.12 || ^24 || ^26, deps jose, basic-auth (about 124 KB); `/authorize` auto-redirects without login UI (simplest to drive); supports PKCE, refresh grant, `/revoke`, `/endsession`; HTTPS via cert/key options. Its discovery lacks `scopes_supported`, which `@hono/oidc-auth` requires (would 500) unless injectable (not checked); not run against `@hono/oidc-auth` (evidence: 2026-10-09-oidc-mock-alternatives).
- **Hand-written jose mock**: not built; fidelity versus `oauth4webapi` ID-token and client-auth validation untested (unverified).

### 4. Security notes
- `OIDC_AUTH_SECRET` must be >= 32 characters or the middleware throws 500 (evidence: 2026-10-09-hono-oidc-auth-package).
- `Secure` is always set on all library cookies, including over `http://localhost`; Chromium and Firefox are known to accept it on localhost, Safari behaviour not confirmed (unverified).
- No `SameSite` attribute is set by the library; effective behaviour is the browser default (unverified per browser). The callback is a cross-site top-level GET from the IdP, so `Strict` would not be sent; `Lax` is (general cookie semantics, unverified here).
- Open redirect: the `continue` value is taken from the request URL (Host-derived unless `OIDC_AUTH_EXTERNAL_URL` is set) and is redirected to without validation; a `next` query inside it is not validated by the library, so the login route must validate it (drizzle-admin's own `safeNext` is not applied to a third-party callback) (evidence: 2026-10-09-hono-oidc-auth-package, 2026-10-09-oidc-auth-oidc-provider-e2e).
- The session JWT exposes the refresh token (`rtk`) to the browser user in a signed but unencrypted cookie (evidence: 2026-10-09-hono-oidc-auth-package).
- `NODE_TLS_REJECT_UNAUTHORIZED=0` disables certificate verification process-wide for Node (it prints a warning); in a test worker it is scoped to that worker's process (evidence: 2026-10-09-oidc-auth-http-issuer).

### Unverified in this section
- Browser behaviour: Secure cookies on http://localhost in Safari, SameSite default in Firefox, a self-signed IdP certificate in a real browser.
- `NODE_EXTRA_CA_CERTS` route; an automatic certificate generation without openssl or extra dependency; patching or wrapping `oauth4webapi` options.
- oidc-provider custom auto-login interaction; `@types` for oidc-provider; Node versions below 24 and the repo's own vitest/CI config (scratch used vitest 5.0.3 defaults on Node 24.21.0).
- oauth2-mock-server end to end with `@hono/oidc-auth`; hand-written jose mock fidelity; refresh-token rotation.

### Evidence referenced
- 2026-10-09-hono-oidc-auth-package, 2026-10-09-oidc-auth-http-issuer, 2026-10-09-oidc-provider-mock-idp, 2026-10-09-oidc-mock-alternatives, 2026-10-09-oidc-auth-oidc-provider-e2e

### Follow-up: option B (https://localhost IdP trusted through NODE_EXTRA_CA_CERTS), verified in a scratch dir
Verdict: feasible with TLS verification enabled everywhere; nothing in the runs disabled it (the harness asserted `NODE_TLS_REJECT_UNAUTHORIZED` was not `0`). Replaces the `NODE_TLS_REJECT_UNAUTHORIZED=0` setup above.
- Certificate without openssl: `selfsigned` 5.5.0 (MIT, node >=18, deps `@peculiar/x509` MIT and `pkijs` BSD-3-Clause; 23 packages, 8.3 MB) generated an EC P-256 sha256 cert with SAN `localhost` + `127.0.0.1` in 12-21 ms; `algorithm: "sha256"` must be passed (default sha1). A non-CA self-signed leaf worked as a trust anchor (evidence: 2026-10-09-selfsigned-cert-generation, 2026-10-09-extra-ca-certs-flow). A committed key/cert pair was not tried; it would trip secret scanners and expire (unverified). Facts favour generation at run time (no secret in git, no expiry) at the cost of one dev dependency; this is for the designer to decide.
- (a) Example: a launcher generates the cert into a `mkdtemp` dir and spawns the app process with `NODE_EXTRA_CA_CERTS=<ca.pem>`; one child process hosts both the https IdP and the http app. Full flow (unauthenticated `/admin/users/?q=a` -> `/oidc/login?next=...` -> IdP -> callback -> back to the login route -> validated `next` -> page 200 through a `Request`-keyed getUser-style bridge -> hostile `next` becomes `/` -> logout -> redirect to login again) passed: flow 78 ms, launcher total 230 ms. Negative control (extra CA pointing elsewhere) failed with 500, so trust came from the extra CA (evidence: 2026-10-09-extra-ca-certs-flow).
- (b) vitest 5.0.3: a `globalSetup` that generates the cert and sets `process.env.NODE_EXTRA_CA_CERTS` (plus a dir variable for key/cert) before workers start works with the default `forks` pool; the same flow passed in 347-362 ms total. It FAILS with `pool: "threads"`, because the variable is read at process start. The repo's `vitest.config.ts` sets no pool, default is forks (evidence: 2026-10-09-extra-ca-certs-flow).
- Caveat on fidelity: the admin was mimicked by a Hono sub-app reading the user from a `WeakMap<Request, user>`; the real `createAdmin` with `getUser`/`loginUrl` was not run (unverified).
- (3) Browsers: MDN states the `https:` requirement for `Secure` is ignored on localhost (Chromium and Gecko); Safari/WebKit is reported not to accept Secure cookies from `http://localhost` (WebKit bugs 232088, 231035; current status unchecked) (evidence: 2026-10-09-secure-cookie-localhost-browsers). So the http app works in Chrome/Firefox; in Safari the `oidc-auth` cookie would not be stored and login would loop (inference, unverified). Serving the app over https would fix Safari but needs a certificate the browser trusts, plus the same warning handling; it also makes drizzle-admin's own cookies `Secure` (README: when the request URL or `publicOrigin` is `https:`). Not tested in any browser.
- Browser reaching the IdP: `NODE_EXTRA_CA_CERTS` trusts the cert only inside Node. A browser sent to `https://localhost:<idp port>` will show a certificate warning once unless the cert is trusted in the OS/browser store (not tested; unverified). This applies to a manual `pnpm example:oidc` session, not to the vitest run.
- Unverified: real createAdmin end to end; threads/vmForks pools beyond the failure noted; Windows/macOS; Node 22; Safari bug status.
- Evidence added: 2026-10-09-selfsigned-cert-generation, 2026-10-09-extra-ca-certs-flow, 2026-10-09-secure-cookie-localhost-browsers
