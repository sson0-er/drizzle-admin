# Interface: release checks (tarball smoke test and CI)

Changed 2026-10-09: new file (decision 052).

Changed 2026-10-09 (decision 052 points 9-11, Q16-Q18): tarball content check (step 6a), `.github/dependabot.yml`, Node 22 and 24 only.
Changed 2026-10-09 (decision 052 points 12-13, design review): `require()` check (step 9a); a Node 22 failure blocks the task.

Files: `scripts/smoke-pack.sh` (mode 100755, like `scripts/verify.sh`), `scripts/smoke/consumer.ts`, `scripts/smoke/tsconfig.json`, `.github/workflows/ci.yml`, `.github/dependabot.yml`. Package metadata lives in [project-setup.md](project-setup.md).

## Responsibilities
- Prove that the published files work for a consumer: the `exports` map and `types` resolve under the scoped name, runtime dependencies and peers resolve from the consumer's own `node_modules`, and `createAdmin` serves pages on SQLite and PostgreSQL (PGlite).
- Run the existing gate (`scripts/verify.sh`) and the smoke test on GitHub Actions for every push and pull request to `main`, on the Node version from `mise.toml` and on Node 22 (the `engines` floor). Node 26 is not tested (Q18).
- Not responsible for publishing: no publish job, no tokens, no version bumps or tags.

## `scripts/smoke-pack.sh`
Not part of `scripts/verify.sh` or `pnpm test`: it downloads packages from the npm registry and takes about a minute. It runs in CI and by hand before publishing. Exit status 0 means every step passed; any failing command or check exits non-zero (`set -euo pipefail`).

Steps, in order:
1. Header and setup, as in `verify.sh`: `#!/usr/bin/env bash`, a one-line purpose comment, `set -euo pipefail`, `cd "$(dirname "$0")/.."`.
2. Tools: when `mise` is on `PATH` and `SMOKE_PACK_UNDER_MISE` is unset, re-run once as `exec env SMOKE_PACK_UNDER_MISE=1 mise exec -- bash scripts/smoke-pack.sh "$@"`. Why (comment in the script): the consumer lives outside the repository, where `mise.toml` does not apply, so the pinned tools must already be on `PATH` for every child process (npm, node, tsc, and the `pnpm build` that `prepack` runs). `MISE_NODE_VERSION` set by the caller still applies (CI uses it for Node 22).
3. Print `node --version` so logs show which Node ran.
4. `work="$(mktemp -d)"`; `trap 'rm -rf "$work"' EXIT` (the script removes only the directory it created). The directory is outside the repository so module resolution cannot fall back to the repository's `node_modules`.
5. Collect the install specs while still in the repository root: for each of `drizzle-orm`, `hono`, `better-sqlite3`, `@electric-sql/pglite`, `typescript`, `@types/better-sqlite3`, `@types/node`, read the exact version from `package.json` `devDependencies` with `node -p 'require("./package.json").devDependencies[process.argv[1]]' "$name"` (the name is passed as an argument, not spliced into the code) and append `"$name@$version"` to a bash array.
6. `npm pack --pack-destination "$work"`. This runs `prepack` (`pnpm build`), so the tarball holds a fresh `dist/` (evidence: 2026-10-09-tarball-smoke-prototype). Take the single `"$work"/*.tgz` as the tarball path (fail if there is not exactly one).
6a. Tarball content (decision 052 point 9): list it once with `tar -tzf "$tarball"`; fail with a message naming the problem unless the list contains `package/src/index.ts` and `package/dist/index.js`, and fail if any entry starts with `package/test/`, `package/example/` or `package/scripts/`.
7. `mkdir "$work/consumer"`; copy `scripts/smoke/consumer.ts` and `scripts/smoke/tsconfig.json` into it; write `"$work/consumer/package.json"` with exactly `{ "name": "smoke-consumer", "private": true, "type": "module" }`.
8. In `"$work/consumer"`: `npm install --ignore-scripts --no-audit --no-fund "$tarball" "${specs[@]}"`. `--ignore-scripts` is safe because better-sqlite3 13.0.3 has no install script and ships prebuilt binaries (evidence: 2026-10-09-tarball-smoke-prototype). There is no lockfile, so `zod` resolves from the published range as it would for a user.
9. In `"$work/consumer"`: `./node_modules/.bin/tsc -p tsconfig.json` (type check and emit to `out/`), then `node out/consumer.js`.
9a. Still in `"$work/consumer"`, the CommonJS check (decision 052 point 13): `node --input-type=commonjs -e '<code>'` where the code `require`s `"@sson0-er/drizzle-admin"` and exits with status 1 (message `require(): createAdmin missing`) unless `typeof m.createAdmin === "function"`; then print `ok require`. It needs the `default` export condition and require(esm) without a flag (Node 22.12+; evidence: 2026-10-09-require-esm). Type resolution for TypeScript CommonJS consumers is not covered.
10. Print `smoke-pack: ok`.

## `scripts/smoke/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "rootDir": ".",
    "outDir": "out"
  },
  "include": ["consumer.ts"]
}
```
`skipLibCheck: true` because drizzle-orm 0.45.3 and pglite 0.5.8 declarations fail a full library check under TypeScript 7.0.2 (evidence: 2026-10-09-tarball-smoke-prototype); the `@ts-expect-error` below detects packed types that degraded to `any`. The repository's `tsconfig.json` does not include `scripts/`, so `pnpm typecheck` never sees `consumer.ts` (its import only resolves after packing); Biome still formats and lints it.

## `scripts/smoke/consumer.ts`
An ESM module with top-level `await`. Imports: `createAdmin` and `type AdminConfig` from `"@sson0-er/drizzle-admin"`; `Hono` from `"hono"`; `Database` from `"better-sqlite3"`; `drizzle` from `"drizzle-orm/better-sqlite3"` and from `"drizzle-orm/pglite"` (renamed); `integer`, `sqliteTable`, `text` from `"drizzle-orm/sqlite-core"`; `pgTable`, `serial`, `text` (renamed) from `"drizzle-orm/pg-core"`; `PGlite` from `"@electric-sql/pglite"`.

Shared values: `secret = "s".repeat(32)`; `auth: AdminConfig["auth"] = { getUser: async () => ({ id: "smoke", name: "smoke" }) }` (external mode, so GET pages need no login round trip); `basePath: "/admin"`.

`expectPage(label, fetch, path, text?)`: sends ``new Request(`http://localhost${path}`)`` through `fetch`; throws ``new Error(`${label} ${path}: status ${res.status}`)`` unless the status is 200, and ``new Error(`${label} ${path}: "${text}" missing`)`` when `text` is given and the body does not contain it.

1. SQLite: `new Database(":memory:")`, `exec` of `create table items (id integer primary key autoincrement, name text not null); insert into items (name) values ('smoke-row')`; `items = sqliteTable("items", { id: integer().primaryKey({ autoIncrement: true }), name: text().notNull() })`; `sqliteAdmin = createAdmin({ db: drizzle(sqlite), dialect: "sqlite", basePath: "/admin", secret, auth })`; `sqliteAdmin.register(items, { listDisplay: ["id", "name"] })`; mount it in the consumer's own app, `const app = new Hono(); app.route("/admin", sqliteAdmin.app);` (proves the peer `Hono` type and instance are shared); `expectPage("sqlite", (req) => app.fetch(req), "/admin/")` and the same with `"/admin/items/", "smoke-row"`; close the database; print `ok sqlite`.
2. PostgreSQL: `new PGlite()`, `exec` of `create table items (id serial primary key, name text not null); insert into items (name) values ('smoke-row')`; `pgItems = pgTable("items", { id: serial().primaryKey(), name: pgText().notNull() })`; `pgAdmin = createAdmin({ db: drizzlePg(pg), dialect: "postgres", basePath: "/admin", secret, auth })`; `pgAdmin.register(pgItems)`; the same two `expectPage` calls through `(req) => pgAdmin.fetch(req)`; `await pg.close()`; print `ok postgres`.
3. Type-only check, compiled but never called (comment says so):
   ```ts
   function typeOnly(): void {
     // @ts-expect-error "missing" is not a column of items (column keys stay typed after packing)
     sqliteAdmin.register(items, { slug: "typecheck", listDisplay: ["missing"] });
   }
   void typeOnly;
   ```

## `.github/workflows/ci.yml`
The file is exactly:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: jdx/mise-action@2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca # v5.1.1
        with:
          version: 2026.10.3
      - run: pnpm install --frozen-lockfile
      - run: scripts/verify.sh
      - run: scripts/smoke-pack.sh

  # engines.node is ">=22": prove the packed package on the oldest supported line.
  smoke-node22:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    env:
      MISE_NODE_VERSION: "22"
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: jdx/mise-action@2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca # v5.1.1
        with:
          version: 2026.10.3
          # Not shared with the verify job: its cache key comes from mise.toml, not from MISE_NODE_VERSION.
          cache: false
      - run: pnpm install --frozen-lockfile
      - run: scripts/smoke-pack.sh
```
Rules:
- Every `uses:` is a full 40-character commit SHA with the release tag as a trailing comment; tags are mutable, a SHA is not (evidence: 2026-10-09-github-actions-pinning). The SHAs above are the latest releases on 2026-10-09; Dependabot proposes updates monthly (`.github/dependabot.yml` below).
- `permissions: contents: read` at the top level and nowhere widened; `persist-credentials: false` keeps the token out of `.git/config`. No secrets are used.
- Node and pnpm come from `mise.toml` through `jdx/mise-action` (no versions in the workflow, no `packageManager` field, decision 001); the mise binary itself is pinned with `version` and verified by the action against signed checksums (evidence: 2026-10-09-github-actions-pinning). `MISE_NODE_VERSION: "22"` selects the newest Node 22 release for the second job.
- `pnpm install --frozen-lockfile` fails when `pnpm-lock.yaml` does not match `package.json`.
- Unverified until the first run (the implementer reports it): that the job-level `MISE_NODE_VERSION` reaches mise-action's install step (the script's `node --version` line shows v22), and that mise needs no `mise trust` for this tools-only `mise.toml`. If either fails, the fix is recorded in the task History and this file is updated.
- Any other failure of `smoke-node22` (for example better-sqlite3's bundled prebuild not loading on Node 22 under `--ignore-scripts`, a page check, or the `require()` check) means the task is reported blocked with the failing output; `engines`, `--ignore-scripts` and the job are not changed without a new decision (decision 052 point 12).

## `.github/dependabot.yml`
Changed 2026-10-09: new file (decision 052 point 10, Q17). The file is exactly:
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```
Only the `github-actions` ecosystem; npm dependencies stay manual. Dependabot keeps the full-SHA pins and rewrites the trailing `# vX.Y.Z` comment with each update (evidence: 2026-10-09-dependabot-sha-pins). It does not update the mise-action `version: 2026.10.3` input, which stays a manual edit. Its pull requests run the CI workflow like any other.

## Errors
- Smoke test: a missing `src/index.ts` or `dist/index.js` in the tarball, a published `test/`, `example/` or `scripts/` entry, any failed command, a non-200 page, a missing `smoke-row` or a type error (including an unused `@ts-expect-error`) exits non-zero; the temporary directory is removed in every case.
- CI: a failing step fails its job; there is nothing to clean up.
