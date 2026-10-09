# Interface: project setup and packaging

Files: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`, `biome.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `README.md`, `CHANGELOG.md` (Changed 2026-10-08: added by decision 048). Changed 2026-10-09 (decision 052): the tarball smoke test (`scripts/smoke-pack.sh`, `scripts/smoke/`) and the CI workflow (`.github/workflows/ci.yml`) are specified in [release-checks.md](release-checks.md). `mise.toml` already pins `node = "24.21.0"` and `pnpm = "12.10.0"` (user-managed, decision 001); it is not modified.

## Responsibilities
- Make `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` work from a clean checkout after `pnpm install` (run under mise).
- Produce a publishable package (metadata, MIT LICENSE, README, `dist/`).
- Changed 2026-10-09 (decision 052): publish as the public scoped package `@sson0-er/drizzle-admin`, with `drizzle-orm` and `hono` as peers and `engines.node` `>=22`. The product name stays "drizzle-admin" everywhere else (README title, the `drizzle-admin: ` error prefix, cookie names, the demo).

## API (commands)
| Command | Script | Expectation |
|---|---|---|
| `pnpm test` | `vitest run` | all tests pass |
| `pnpm typecheck` | `tsc -p tsconfig.json --noEmit` | 0 errors across `src`, `test`, `example`, `vitest.config.ts` |
| `pnpm lint` | `biome check .` | 0 errors |
| `pnpm build` | `node -e "require('node:fs').rmSync('dist',{recursive:true,force:true})" && tsc -p tsconfig.build.json` | `dist/index.js` and `dist/index.d.ts` plus per-module files |
| `pnpm example` | `tsx example/server.ts` | demo server (example.md) |
| `pnpm example:oidc` | `tsx example/oidc/launch.ts` | Changed 2026-10-09 (decision 053): OIDC SSO demo with a local mock IdP, or a real IdP via `OIDC_ISSUER` (example-oidc.md) |
| `pnpm format` | `biome check --write .` | convenience |
| (lifecycle) `prepack` | `pnpm build` | Changed 2026-10-08 (decision 048): runs before every `npm pack` / `npm publish` and in `pnpm publish`, so the tarball's `dist/` is always built from the current `src/` (evidence: 2026-10-08-prepack-lifecycle) |

## Data formats

### package.json
Changed 2026-10-09 (decision 053): script `example:oidc` and four exact-pinned devDependencies for the OIDC example: `@hono/oidc-auth` 1.10.0, `oidc-provider` 9.12.2, `@types/oidc-provider` 9.12.1, `selfsigned` 5.5.0 (evidence: 2026-10-09-oidc-example-package-types). Run `pnpm install` so `pnpm-lock.yaml` matches. `files`, `dependencies` and `peerDependencies` do not change, so nothing of the example reaches the tarball (the smoke test's content check already fails on `package/example/`). Their engines allow Node 22 and none has an install script, so the CI `smoke-node22` job's `pnpm install --frozen-lockfile` is unaffected (pnpm 12's reaction to engines is unverified; a failure there blocks the task). Importing `@hono/oidc-auth` anywhere in the type-check program augments hono's `ContextVariableMap` with `oidc*` keys; no admin variable uses those names, and `tsconfig.build.json` (src only) never sees it.
Changed 2026-10-09 (decision 052): scoped `name`, `repository` / `homepage` / `bugs`, `engines`, `publishConfig`; `hono` moved from `dependencies` to `peerDependencies` (range `^4.13.13`) and added to `devDependencies` (exact `4.13.13`). Run `pnpm install` afterwards so `pnpm-lock.yaml` matches (CI installs with `--frozen-lockfile`). Top-level key order as below.
Changed 2026-10-09 (decision 052 point 13, design review): `exports` gains `"default": "./dist/index.js"`, the same ESM file as `import`, so `require()` from a CommonJS host resolves on Node versions with require(esm) enabled (22.12 and later); without it `require()` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` (evidence: 2026-10-09-require-esm). The package stays ESM-only; there is no CommonJS build.
Changed 2026-10-09 (decision 052 point 9, Q16): `files` also lists `src`, so the shipped source maps and declaration maps (`sourceMap` and `declarationMap` stay on in `tsconfig.build.json`) resolve their `../src/*.ts` references inside the package. `src/` contains only library sources; tests, fixtures, `example/` and `scripts/` are not published (the smoke test checks this, release-checks.md).
```jsonc
{
  "name": "@sson0-er/drizzle-admin",
  "version": "0.1.0",
  "description": "Django Admin-style, server-rendered CRUD admin for Drizzle ORM tables",
  "license": "MIT",
  "author": "Shoma Sonoda",
  "repository": { "type": "git", "url": "git+https://github.com/sson0-er/drizzle-admin.git" },
  "homepage": "https://github.com/sson0-er/drizzle-admin#readme",
  "bugs": { "url": "https://github.com/sson0-er/drizzle-admin/issues" },
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "default": "./dist/index.js" } },  // default: decision 052 point 13
  "types": "./dist/index.d.ts",
  "files": ["dist", "src", "README.md", "LICENSE", "CHANGELOG.md"],   // CHANGELOG.md: decision 048; src: decision 052 point 9
  "sideEffects": false,
  "keywords": ["drizzle", "drizzle-orm", "admin", "hono", "crud"],
  "scripts": { /* table above */ },
  "engines": { "node": ">=22" },                       // decision 052
  "publishConfig": { "access": "public" },             // decision 052: the first scoped publish must be public; npm docs disagree on the default
  "peerDependencies": { "drizzle-orm": "^0.45.3", "hono": "^4.13.13" },
  "dependencies": { "zod": "^4.6.5" },
  "devDependencies": {  // exact versions (decision 005); the file keeps these keys sorted
    "drizzle-orm": "0.45.3", "hono": "4.13.13", "typescript": "7.0.2", "vitest": "5.0.3", "@biomejs/biome": "2.5.15",
    "better-sqlite3": "13.0.3", "@types/better-sqlite3": "9.6.0", "@electric-sql/pglite": "0.5.8",
    "parse5": "8.0.1", "@hono/node-server": "2.1.3", "tsx": "4.23.15", "@types/node": "24.19.1",
    "@hono/oidc-auth": "1.10.0", "oidc-provider": "9.12.2", "@types/oidc-provider": "9.12.1", "selfsigned": "5.5.0"  // decision 053
  }
}
```
No `packageManager` field (decision 001). Changed 2026-10-09 (decision 052): `repository`, `homepage` and `bugs` now point at the GitHub repository. `zod` stays a regular dependency because no public type mentions it (`src/types.ts` imports only the `Table` type from drizzle-orm and the `Hono` type from hono). Why `>=22`: the code needs the global Web Crypto (`crypto.subtle`, unflagged since Node 19) and other globals present in every supported line; Node 20 is end-of-life and 22 is the oldest LTS line, checked in CI by the smoke test (evidence: 2026-10-09-node-minimum-version). `engines` only warns unless the consumer sets `engine-strict` (evidence: 2026-10-09-npm-publish-fields).
If `pnpm install` reports ignored dependency build scripts that break a tool (for example esbuild under tsx; unverified), allow that package explicitly in pnpm's config and record the change in a decision.

### tsconfig.json (type-check everything)
```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true,
    "verbatimModuleSyntax": true, "isolatedModules": true, "skipLibCheck": true,
    "jsx": "react-jsx", "jsxImportSource": "hono/jsx",
    "types": ["node"], "noEmit": true
  },
  "include": ["src", "test", "example", "vitest.config.ts"]
}
```
### tsconfig.build.json (src only, Web-standard types only)
Extends `tsconfig.json`; overrides: `"types": []`, `"noEmit": false`, `"declaration": true`, `"declarationMap": true`, `"sourceMap": true`, `"outDir": "dist"`, `"rootDir": "src"`; `"include": ["src"]`.
`types: []` makes any use of Node globals in `src` a build error (Web-standard requirement).

Relative imports in all TS files use the `.js` suffix (`./views/layout.js` for `layout.tsx`).

### biome.json
```jsonc
{
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["**", "!dist", "!node_modules"] },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "rules": { "recommended": true,
    "suspicious": { "noExplicitAny": "error" },
    "security": { "noDangerouslySetInnerHtml": "error" } } },
  "overrides": [ { "includes": ["src/**"], "linter": { "rules": { "correctness": { "noNodejsModules": "error" } } } } ]
}
```
Allowed `any` only in `src/introspect/**` and `src/data/**`, each with `// biome-ignore lint/suspicious/noExplicitAny: <why>` (decision 004). The exact Biome 2.5 config keys (`includes` vs `include`) must be checked against `biome migrate` / its schema at setup.

### vitest.config.ts
`defineConfig({ test: { include: ["test/**/*.test.ts", "test/**/*.test.tsx"], environment: "node" } })`. The JSX settings come from tsconfig (evidence: 2026-10-07-ts7-vitest-biome-compat).
Changed 2026-10-09 (decision 053): the existing `testTimeout` / `hookTimeout` stay; add
```ts
    // The OIDC test trusts its mock IdP through NODE_EXTRA_CA_CERTS, which Node reads only when a
    // process starts: workers must be child processes spawned after the global setup has set it.
    // forks is vitest's default; pinned so a change of default or a switch to threads fails loudly
    // here instead of as a TLS error (decision 053).
    pool: "forks",
    globalSetup: ["test/helpers/oidc-global-setup.ts"],
```
The global setup applies to the whole run (certificate generation takes about 20 ms; no other test opens a TLS connection), see test-strategy.md (evidence: 2026-10-09-extra-ca-certs-flow).

### .gitignore
`node_modules/`, `dist/`, `coverage/`, `example/*.sqlite*`.

### LICENSE
MIT License text, `Copyright (c) 2026 Shoma Sonoda`.

### CHANGELOG.md (decisions 048, 052)
Changed 2026-10-09 (decision 052): this is the first release, so the former `## Unreleased` lists (decisions 042-051, written as changes against an earlier version) are replaced by initial-release notes; nothing assumes a previous release (no "signed out once after upgrading", no "existing users switch once").

English. The whole file is exactly:
```markdown
# Changelog

## 0.1.0 - Unreleased

Initial release.

### Added

- `createAdmin`, `admin.register`, `admin.app` and `admin.fetch`: a server-rendered, Django Admin-style CRUD admin for Drizzle ORM tables, mounted in a Hono app. `drizzle-orm` (`^0.45.3`) and `hono` (`^4.13.13`) are peer dependencies; Node.js 22 or later.
- SQLite and PostgreSQL.
- List pages with search, filters, sortable columns and pagination; bulk delete and custom actions with an optional confirmation page.
- Add and change forms generated from the table definition, with widget overrides, zod validation, a `validate` callback, hooks and read-only fields.
- Built-in login with a signed session cookie, or external authentication through `getUser` and `loginUrl`; per-model `view` / `add` / `change` / `delete` permissions.
- Security: HMAC-signed cookies with keys derived per admin instance, CSRF protection (Origin check and token), Content-Security-Policy and other security headers, and bounded input (search text, selections and `listPerPage`).
- English and Japanese UI, English by default, with a language switcher remembered in the `da_lang` cookie.
- Light and dark color schemes and a responsive layout; everything works without JavaScript except "select all".
```
Whoever publishes replaces `Unreleased` with the publish date (`YYYY-MM-DD`) in the commit that is published (manual publish step, out of scope; decision 052 point 5). The README "Changelog" pointer (after section 11) is unchanged.

### README.md outline (written in phase 6; English)
Changed 2026-10-07: section 10 lists the SQLite blob-bigint ordering limitation (decision 026).
Changed 2026-10-08: section 10 lists the decoded LF/CR 404 limitation (decision 029).
Changed 2026-10-08: sections 8 and 10 tell deployers to limit the request body size at the proxy (decision 038); section 9 notes the password widget and FK view-permission behaviors (decisions 034, 037); section 11 uses `127.0.0.1` and `HOST` for the example (decision 038).
Changed 2026-10-08: section 8 states the Origin check scope (form-like unsafe requests only) and that such a request with neither `Sec-Fetch-Site: same-origin` nor a matching `Origin` gets 403 (task 36, L050, L087; evidence: 2026-10-07-hono-csrf-and-jsx); section 11 notes that an empty `HOST` falls back to `127.0.0.1` (decision 038 item 2).
Changed 2026-10-08: section 9 notes that `password`-widget list columns cannot be sorted (decision 037 point 6, L011).
Changed 2026-10-08: section 6 lists the `password` widget restrictions of `register()` (decision 037 point 7, Q12).
Changed 2026-10-08: security audit fixes (decisions 042-048), by section. 5: the `secret` row recommends a distinct secret per admin instance (and not reused elsewhere in the host) and says the cookie keys are derived from `secret` and `basePath`; the `sessionMaxAgeSec` row states the 34560000 (400 days) maximum. 6: the `listDisplay` default skips `exclude` columns, the `exclude` row says it also affects the default list columns, the `readonlyFields` row adds identity columns to the always-display-only list, the `permissions` row says unset `add` / `change` / `delete` follow `view` (unset everything: all allowed). 6 also: the `listPerPage` row says "a positive integer of at most 500" (decision 045 point 5, Q13). 7: at most 500 rows can be selected for one action; more gives a warning and runs nothing. 8: "Authentication modes" says the host's login page must still validate `next` (the admin sends only `safeNext` paths, decision 047); the cookies table says the HMAC key is derived per cookie from `secret` and `basePath`; "CSRF and headers" lists `X-Content-Type-Options: nosniff` and the CSP of routes.md (no `form-action` in external mode, so SSO redirect chains work) and says a host app that adds its own CSP must allow the same sources; "Permissions" says a model without any permission for the user answers 404 like an unknown page, and that granting `change` or `delete` without `view` shows row labels and read-only values on those pages. 9: search text has NUL characters removed and is cut to 200 characters; a malformed or out-of-range key in a URL is a 404 and in a filter is ignored. 11: the example rejects requests whose Host is not the bound host (loopback names allowed for loopback and wildcard binds, IP literals for wildcard binds; decision 048). A "Changelog" pointer to `CHANGELOG.md` is added after section 11.

Changed 2026-10-09: internationalization (decisions 049-051), by section. 1: the feature list says "English and Japanese UI". 5: the `siteTitle` row's default is "Site administration" (English) / "サイト管理" (Japanese), following the visitor's language; a configured title is not translated. 6: the `slug` row lists `_lang` with `login`, `logout` and `static` as reserved. 8: the cookies table adds `da_lang` (unsigned, value `en` or `ja`, one year, same `Path` / `HttpOnly` / `SameSite` / `Secure` rules; not a security cookie). New section "Language" after 8: English is the default for every visitor; the header switcher (a POST form, works without JavaScript) stores the choice in `da_lang`; `Accept-Language` is not used; there is no option to change the default; model labels, field names, action labels, `toString` and formatter output, `validate` messages and a configured `siteTitle` are shown as written; configuration errors and log lines are English. 10: "Japanese UI only" is replaced by "English and Japanese only; the default language (English) cannot be configured".

Changed 2026-10-09: release preparation (decision 052), by section. 2: "Node.js 24 (the version the test suite runs on)" becomes "Node.js 22 or later. The full test suite runs on Node.js 24; CI also installs the packed package on Node.js 22 and runs a smoke test."; the Hono bullet says Hono `^4.13.13` is a peer dependency to install next to this package, instead of "Hono is a dependency of this package"; a new bullet (decision 052 point 13) says: "The package is ESM-only. A CommonJS application can `require()` it only on a Node.js version that supports `require()` of ES modules without a flag (22.12 or later); otherwise use `import()`." 3: the install command is exactly `pnpm add @sson0-er/drizzle-admin drizzle-orm hono`. 4: the Quick start imports `createAdmin` from `"@sson0-er/drizzle-admin"`; nothing else in it changes. 11: after the `scripts/verify.sh` sentence, one paragraph: "`scripts/smoke-pack.sh` builds and packs the package, installs the tarball into a temporary project and type-checks and runs a small consumer against SQLite and PGlite. It needs access to the npm registry. CI (`.github/workflows/ci.yml`) runs `scripts/verify.sh` and the smoke test on every push and pull request to `main`." The `# drizzle-admin` title and the product name in prose stay.

Changed 2026-10-09 (decision 053), by section. 11: the command block gains `pnpm example:oidc     # OIDC sign-in demo with a local mock IdP; open http://localhost:3000/admin/`, and a new subsection "OIDC example" is placed before "Changelog" with the content given in example-oidc.md "README text" (run, real IdP variables, how the bridge and `next` validation work, caveats). No CHANGELOG entry: the published files do not change.

Changed 2026-10-07: section 6 points at all sources of `register()` constraints (decisions 013 item 13, 021, 023; admin.md step 5).

Changed 2026-10-07: `publicOrigin` documented in sections 5 and 8, new reverse-proxy subsection, proxy caveat removed from known limitations, `HookCtx` and action permission documented (decisions 015-017).

1. What it is, plus a screenshot-free feature list. 2. Requirements (Node 22 or later, full suite on Node 24; drizzle-orm ^0.45.3 and hono ^4.13.13 peers; SQLite/PostgreSQL; Changed 2026-10-09, decision 052). 3. Install (`pnpm add @sson0-er/drizzle-admin drizzle-orm hono`; Changed 2026-10-09, decision 052). 4. Quick start (the §5.1 example; mount at `basePath`; `admin.fetch`). 5. Configuration reference: every `AdminConfig` / `AuthConfig` field with its default, including `publicOrigin` (optional, default: derived from each request URL; decision 017). 6. Model options reference: every `ModelAdminOptions` field with its default and the constraints `register()` enforces, taken from admin.md step 5 (decision 013 item 13; the allowed-widgets table per field in forms.md / decision 021; the `password` widget is rejected on the primary key and on fields in `searchFields` or `ordering`, decision 037 point 7; `listFilter` and the `date` widget on PG `date()` string-mode columns, decision 023), and the `HookCtx` shape `{ mode, user, db }` (decision 015). 7. Actions (confirm, casting `db`; custom actions require the model's `change` permission, decision 016). 8. Authentication modes and security (cookies, CSRF + Origin, `next`, headers, permissions; in external mode the session cookie only carries the CSRF token, decision 014; the Origin check covers only unsafe-method requests with a form-like content type (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` or none), which pass with `Sec-Fetch-Site: same-origin` or an `Origin` equal to the expected origin and otherwise get 403, a missing header included; GET/HEAD and other content types skip it, but every POST still needs the `_csrf` token (evidence: 2026-10-07-hono-csrf-and-jsx)), with a subsection "Deploying behind a reverse proxy": set `publicOrigin` to the browser-facing origin (e.g. `"https://admin.example.com"`) when TLS is terminated by a proxy or the app sees an internal host; it is used for the Origin check and the cookie `Secure` flag; without it, form POSTs that do not carry `Sec-Fetch-Site: same-origin` fail with 403 and cookies lack `Secure`; with it, a form-like POST to the internal URL that sends neither header, or a different `Origin`, gets 403; the subsection also tells deployers to limit the request body size at the reverse proxy (or in the host app), because the admin reads each form body fully into memory and has no limit of its own (decision 038). 9. Behavior notes (decision 013, plus: the `password` widget never shows a value (inputs empty; list cells and read-only fields show `********`; its list column has no sort link and `?o=` ignores it, decision 037 point 6) and leaving it empty on the change page keeps the stored value, so a nullable password field cannot be cleared through the form (decision 037); without `view` on a referenced model, FK columns show raw values without links or labels, the FK filter is not offered, and FK form fields are plain key inputs (decision 034)). 10. Known limitations: no login rate limiting (§10), no composite PKs, no MySQL, no file uploads, no inlines/history, Japanese UI only, SQLite needs `PRAGMA foreign_keys = ON` for FK errors (better-sqlite3 enables it by default; evidence: 2026-10-07-pnpm-mise-and-native-deps), on SQLite a bigint column is `blob({ mode: "bigint" })` (drizzle's SQLite `integer()` has no bigint mode), whose values SQLite compares as BLOBs, so sorting and range comparison on it are not numeric (e.g. 10 sorts before 9; equality and FK lookups work; use `integer()` when numeric order matters; evidence: 2026-10-07-sqlite-blob-bigint-ordering; decision 026), a request path containing a percent-encoded LF or CR (`%0a`, `%0d`) is not routed by Hono, so it gets Hono's (or the host app's) plain 404 instead of the admin 404 page and without the admin's security headers (no redirect is issued; decision 029), no request body size limit inside the library (limit it at the reverse proxy or host app; decision 038), drizzle 0.45 only. 11. Development (mise, pnpm scripts, example; the example listens on `127.0.0.1:3000` unless `HOST` / `PORT` are set; an empty `HOST` also falls back to `127.0.0.1`, decision 038). 12. License.

## Errors
- None at runtime. Any failure of the four commands fails the phase gate.
