# 052: Release preparation for the first npm publish: scoped name, hono peer, engines, tarball smoke test and CI

- Date: 2026-10-09
- Status: accepted

## Context
Scope change (2026-10-09, 01-requirements.md): prepare the first npm publish; CI is now in scope; running `npm publish` and release automation stay out of scope. User facts and decisions:
- `drizzle-admin` is taken on npm, so the package is `@sson0-er/drizzle-admin`; the first publish must be public.
- Repository `https://github.com/sson0-er/drizzle-admin`; add `repository`, `homepage`, `bugs`.
- `hono` moves from `dependencies` to `peerDependencies` (like drizzle-orm) and stays a devDependency.
- Add `engines.node`, derived from what the code and dependencies need (not copied from mise.toml).
- CHANGELOG becomes first-release notes for 0.1.0, without wording that assumes an earlier release.
- A tarball smoke test: build, `npm pack`, install into a clean project, exercise `createAdmin` on SQLite and PGlite.
- A GitHub Actions workflow running `scripts/verify.sh` on push and pull_request to `main`, pinned actions, `permissions: contents: read`, node/pnpm consistent with mise.toml, no publish job.

## Decision
Changed 2026-10-09: user answers to Q16-Q18 applied: points 9 (`src` shipped) and 10 (Dependabot) added; Node 22 and 24 only.
Changed 2026-10-09 (design review, release round): points 12 (failure on Node 22 blocks the task) and 13 (`default` export condition, ESM-only statement, `require()` smoke check) added.

1. Package name `@sson0-er/drizzle-admin`, plus `"publishConfig": { "access": "public" }`. The product name stays "drizzle-admin" (README title, the `drizzle-admin: ` error prefix, cookie names, the demo title); only the npm name and import specifier change. `docs/pre-specs.md` is historical and is not edited.
2. Metadata: `"repository": { "type": "git", "url": "git+https://github.com/sson0-er/drizzle-admin.git" }`, `"homepage": "https://github.com/sson0-er/drizzle-admin#readme"`, `"bugs": { "url": "https://github.com/sson0-er/drizzle-admin/issues" }`.
3. Peers: `"peerDependencies": { "drizzle-orm": "^0.45.3", "hono": "^4.13.13" }`; `"dependencies": { "zod": "^4.6.5" }`; devDependency `"hono": "4.13.13"` (exact, decision 005). The lockfile is regenerated with `pnpm install`.
4. `"engines": { "node": ">=22" }`.
5. CHANGELOG: `## Unreleased` becomes `## 0.1.0 - Unreleased` with "Initial release." and one "Added" list (text in interfaces/project-setup.md). Whoever publishes replaces `Unreleased` with the publish date (`YYYY-MM-DD`) in the commit that is published; that step is part of the manual publish, outside this scope.
6. Tarball smoke test `scripts/smoke-pack.sh` with the consumer files in `scripts/smoke/` (interfaces/release-checks.md): `npm pack` (which runs `prepack` → `pnpm build`) into a temporary directory outside the repository, `npm install --ignore-scripts` of the tarball and the exact devDependency versions of the peers and test drivers into a fresh `{"type":"module"}` project, `tsc` on `consumer.ts` (NodeNext, strict, `skipLibCheck: true`, with one `@ts-expect-error` on an unknown column key), then `node` runs the emitted JS: dashboard and list page answer 200 with the seeded row on better-sqlite3 (mounted in the consumer's own `Hono`) and on PGlite (`admin.fetch`). It is not part of `scripts/verify.sh` or `pnpm test` (it needs the npm registry); it runs in CI and manually before publishing.
7. CI `.github/workflows/ci.yml`: triggers `push` and `pull_request` on `main`; top-level `permissions: contents: read`; job `verify` (ubuntu-24.04): checkout with `persist-credentials: false`, `jdx/mise-action` (tools from mise.toml, mise binary pinned to `2026.10.3`), `pnpm install --frozen-lockfile`, `scripts/verify.sh`, `scripts/smoke-pack.sh`; job `smoke-node22`: same setup with job env `MISE_NODE_VERSION: "22"`, then `pnpm install --frozen-lockfile` and `scripts/smoke-pack.sh`. Every `uses:` is pinned to a full commit SHA with the release tag in a trailing comment: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`, `jdx/mise-action@2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca # v5.1.1`. No publish job, no secrets.
8. README: install line `pnpm add @sson0-er/drizzle-admin drizzle-orm hono`, Quick start imports from `"@sson0-er/drizzle-admin"`, Requirements state Node.js 22 or later and hono as a peer; Development mentions `scripts/smoke-pack.sh` and CI. `test/readme.test.ts` gains a case tying the install line and the import specifier to `package.json` `name`.
9. Q16 (user: "the common practice", option (b)): `files` becomes `["dist", "src", "README.md", "LICENSE", "CHANGELOG.md"]`, so the shipped `*.js.map` and `*.d.ts.map` files (both kept on in `tsconfig.build.json`), which reference `../src/*.ts`, resolve inside the package. `src/` holds only library sources (`.ts` / `.tsx`, about 280 KB); tests, fixtures, `example/` and `scripts/` stay out. The smoke test asserts that the tarball contains `package/src/index.ts` and no `package/test/`, `package/example/` or `package/scripts/` entry.
10. Q17: `.github/dependabot.yml` with one entry, ecosystem `github-actions`, directory `/`, interval `monthly`; the workflow keeps full-SHA pins with version comments, which Dependabot updates together (evidence: 2026-10-09-dependabot-sha-pins). No other ecosystem (npm stays manual). The mise `version` input is not covered and stays a manual update.
11. Q18: CI tests Node 24 (mise.toml) and Node 22 only; no Node 26 job.
12. If the Node 22 smoke job fails for any reason other than the two unverified CI mechanics in release-checks.md (`MISE_NODE_VERSION` propagation, `mise trust`), including better-sqlite3's bundled prebuild not loading on Node 22 under `--ignore-scripts` or the `require()` check failing, the implementer reports the task blocked with the failing output. `engines`, `--ignore-scripts` and the job are not changed without a new decision (same pattern as decision 020).
13. `exports` is `{ ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "default": "./dist/index.js" } }`. The package stays ESM-only; `default` points at the same ESM file so a CommonJS host can `require()` it where Node supports require(esm) without a flag (22.12 and later on the 22 line). README Requirements say so. The smoke test adds one `require()` check from a CommonJS context (cheap: one `node` call; it passes on Node 24.21.0 and the Node 22 job runs it on the newest 22.x, which is past 22.13) (evidence: 2026-10-09-require-esm).

## Alternatives considered
- Node minimum `>=20`: the technical floor of the code (global Web Crypto without a flag since v19; hono needs `>=16.9.0`), but Node 20 is end-of-life and nothing here would test it. `>=24` (the only line the full suite runs on): excludes users on Node 22, a supported LTS line the library has no reason to reject. `>=22` is the oldest supported line, and CI proves it with the smoke test.
- Keep `hono` in `dependencies`: the public type `Admin.app` is a `Hono` instance that the host mounts in its own `Hono`, so two hono copies would make the types and instances differ; the user decided on a peer. A wider peer range (`^4.0.0`): untested, and the code relies on hono behavior verified on 4.13 (`hono/csrf` with `Sec-Fetch-Site`, cookie helpers); the lower bound follows the drizzle-orm policy of supporting what was tested (decision 002).
- Access via `npm publish --access public` only: easy to forget, and the npm docs disagree about the default for a new scoped package; `publishConfig.access` applies on every publish, with npm or pnpm.
- Smoke test as a vitest test in `test/`: `pnpm test` would need network access and minutes per run; a script keeps the offline gate fast.
- `pnpm pack` and a pnpm consumer: the user publishes with npm and npm ships with Node; npm also installs peers by default, matching most consumers.
- Type-checking the consumer with `skipLibCheck: false`: fails inside drizzle-orm 0.45.3 and pglite 0.5.8 declarations, not ours; `@arethetypeswrong/cli`: a new tool for a package with one ESM entry and a `types` condition; the `@ts-expect-error` check catches types that degraded to `any`.
- CI tooling via `actions/setup-node` + `pnpm/action-setup`: the versions would be duplicated in the workflow (pnpm/action-setup otherwise reads `packageManager`, which decision 001 forbids) and could drift from mise.toml; mise-action reads mise.toml directly.
- Pin actions by exact tag (`@v7.0.1`): tags are mutable; a full SHA is the only immutable reference.
- Q16 alternatives: keep the maps pointing at missing sources (consumers' debuggers and "go to definition" cannot reach the code), or turn the maps off (no mapping at all); shipping the sources is the common practice for packages that ship maps.
- Q17 alternatives: manual updates only (pins go stale silently); Renovate (another app to install). Weekly interval: more PRs than a small project needs.
- Review alternative for `exports`: keep import-only and only document ESM-only; a CommonJS `require()` then fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` even on Node versions that could load the file (evidence: 2026-10-09-require-esm). A dual CommonJS build: a second build output for no stated need.
- Q18 alternative: a Node 26 smoke job (about a minute per run); the user kept 22 and 24.
- A Node version matrix for the whole `verify` job: vitest and better-sqlite3 support 22, but the library behavior on 22 is what consumers need, and the smoke test covers it at a fraction of the cost.

## Rationale
- Packing and installing the tarball into a clean project, type-checking a consumer with NodeNext and running it on both dialects works, with `--ignore-scripts` safe because better-sqlite3 13.0.3 ships prebuilds (evidence: 2026-10-09-tarball-smoke-prototype).
- drizzle-orm and pglite declarations fail `skipLibCheck: false`, and an unknown column key is a type error against the packed types (evidence: 2026-10-09-tarball-smoke-prototype).
- The code uses the global Web Crypto, `TextEncoder`, `btoa` and `Intl`; global `crypto` is unflagged since Node 19; Node 20 is EOL, 22 and 24 are LTS (evidence: 2026-10-09-node-minimum-version).
- GitHub recommends full-length SHA pins and read-only default token permissions; the SHAs above are the latest release tags; mise-action reads mise.toml and verifies the mise binary; `MISE_NODE_VERSION` overrides the node version (evidence: 2026-10-09-github-actions-pinning).
- `publishConfig` applies at publish time; the npm docs contradict each other on the default access of a new scoped package; `engines` is advisory unless `engine-strict`; peers install by default since npm 7 (evidence: 2026-10-09-npm-publish-fields).
- Dependabot rewrites both the SHA and the trailing `# vX.Y.Z` comment of a SHA-pinned action (evidence: 2026-10-09-dependabot-sha-pins).
- That a job-level `MISE_NODE_VERSION` reaches mise-action's install step is unverified; the first CI run confirms it (the job prints `node --version`).

## Consequences
- interfaces/project-setup.md (package.json, CHANGELOG, README outline), new interfaces/release-checks.md (smoke script, CI workflow), README.md (components, layout, project rules), test-strategy.md, questions.md, decisions-and-evidence.md.
- CLAUDE.md: Commands gain `scripts/smoke-pack.sh` and the CI note; Overview names the npm package (design README "Project rules affected").
- Dependabot opens monthly pull requests for new action releases; they run CI like any pull request. The mise `version` stays a manual update.
- The tarball also contains `src/`, so the package grows by the sources (about 280 KB unpacked).
- Consumers of npm with `engine-strict` on Node below 22 cannot install; others get a warning only.
