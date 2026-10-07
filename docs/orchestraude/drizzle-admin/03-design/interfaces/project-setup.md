# Interface: project setup and packaging

Files: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.build.json`, `biome.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `README.md`. `mise.toml` already pins `node = "24.21.0"` and `pnpm = "12.10.0"` (user-managed, decision 001); it is not modified.

## Responsibilities
- Make `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` work from a clean checkout after `pnpm install` (run under mise).
- Produce a publishable package (metadata, MIT LICENSE, README, `dist/`).

## API (commands)
| Command | Script | Expectation |
|---|---|---|
| `pnpm test` | `vitest run` | all tests pass |
| `pnpm typecheck` | `tsc -p tsconfig.json --noEmit` | 0 errors across `src`, `test`, `example`, `vitest.config.ts` |
| `pnpm lint` | `biome check .` | 0 errors |
| `pnpm build` | `node -e "require('node:fs').rmSync('dist',{recursive:true,force:true})" && tsc -p tsconfig.build.json` | `dist/index.js` and `dist/index.d.ts` plus per-module files |
| `pnpm example` | `tsx example/server.ts` | demo server (example.md) |
| `pnpm format` | `biome check --write .` | convenience |

## Data formats

### package.json
```jsonc
{
  "name": "drizzle-admin",
  "version": "0.1.0",
  "description": "Django Admin-style, server-rendered CRUD admin for Drizzle ORM tables",
  "license": "MIT",
  "author": "Shoma Sonoda",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "keywords": ["drizzle", "drizzle-orm", "admin", "hono", "crud"],
  "scripts": { /* table above */ },
  "peerDependencies": { "drizzle-orm": "^0.45.3" },
  "dependencies": { "hono": "^4.13.13", "zod": "^4.6.5" },
  "devDependencies": {  // exact versions (decision 005)
    "drizzle-orm": "0.45.3", "typescript": "7.0.2", "vitest": "5.0.3", "@biomejs/biome": "2.5.15",
    "better-sqlite3": "13.0.3", "@types/better-sqlite3": "9.6.0", "@electric-sql/pglite": "0.5.8",
    "parse5": "8.0.1", "@hono/node-server": "2.1.3", "tsx": "4.23.15", "@types/node": "24.19.1"
  }
}
```
No `packageManager` field (decision 001). `repository`/`homepage` fields are omitted until a repository URL exists.
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

### .gitignore
`node_modules/`, `dist/`, `coverage/`, `example/*.sqlite*`.

### LICENSE
MIT License text, `Copyright (c) 2026 Shoma Sonoda`.

### README.md outline (written in phase 6; English)
Changed 2026-10-07: section 10 lists the SQLite blob-bigint ordering limitation (decision 026).

Changed 2026-10-07: section 6 points at all sources of `register()` constraints (decisions 013 item 13, 021, 023; admin.md step 5).

Changed 2026-10-07: `publicOrigin` documented in sections 5 and 8, new reverse-proxy subsection, proxy caveat removed from known limitations, `HookCtx` and action permission documented (decisions 015-017).

1. What it is, plus a screenshot-free feature list. 2. Requirements (Node 24 verified; drizzle-orm ^0.45.3; SQLite/PostgreSQL). 3. Install (`pnpm add drizzle-admin drizzle-orm`). 4. Quick start (the §5.1 example; mount at `basePath`; `admin.fetch`). 5. Configuration reference: every `AdminConfig` / `AuthConfig` field with its default, including `publicOrigin` (optional, default: derived from each request URL; decision 017). 6. Model options reference: every `ModelAdminOptions` field with its default and the constraints `register()` enforces, taken from admin.md step 5 (decision 013 item 13; the allowed-widgets table per field in forms.md / decision 021; `listFilter` and the `date` widget on PG `date()` string-mode columns, decision 023), and the `HookCtx` shape `{ mode, user, db }` (decision 015). 7. Actions (confirm, casting `db`; custom actions require the model's `change` permission, decision 016). 8. Authentication modes and security (cookies, CSRF + Origin, `next`, headers, permissions; in external mode the session cookie only carries the CSRF token, decision 014), with a subsection "Deploying behind a reverse proxy": set `publicOrigin` to the browser-facing origin (e.g. `"https://admin.example.com"`) when TLS is terminated by a proxy or the app sees an internal host; it is used for the Origin check and the cookie `Secure` flag; without it POSTs fail with 403 and cookies lack `Secure`. 9. Behavior notes (decision 013). 10. Known limitations: no login rate limiting (§10), no composite PKs, no MySQL, no file uploads, no inlines/history, Japanese UI only, SQLite needs `PRAGMA foreign_keys = ON` for FK errors (better-sqlite3 enables it by default; evidence: 2026-10-07-pnpm-mise-and-native-deps), on SQLite a bigint column is `blob({ mode: "bigint" })` (drizzle's SQLite `integer()` has no bigint mode), whose values SQLite compares as BLOBs, so sorting and range comparison on it are not numeric (e.g. 10 sorts before 9; equality and FK lookups work; use `integer()` when numeric order matters; evidence: 2026-10-07-sqlite-blob-bigint-ordering; decision 026), drizzle 0.45 only. 11. Development (mise, pnpm scripts, example). 12. License.

## Errors
- None at runtime. Any failure of the four commands fails the phase gate.
