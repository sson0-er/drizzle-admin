# 005: Runtime and development dependencies (including those beyond pre-spec §3)

- Date: 2026-10-07
- Status: accepted

## Context
Requirements: dependencies beyond pre-spec §3 are recorded with reasons. We also have to decide which packages are runtime dependencies, peers or dev-only.

## Decision
- peerDependencies: drizzle-orm `^0.45.3` (decision 002).
- dependencies: hono `^4.13.13`, zod `^4.6.5`.
- devDependencies (exact): drizzle-orm 0.45.3, typescript 7.0.2, vitest 5.0.3, @biomejs/biome 2.5.15, better-sqlite3 13.0.3, @types/better-sqlite3 9.6.0, @electric-sql/pglite 0.5.8, parse5 8.0.1, @hono/node-server 2.1.3, tsx 4.23.15, @types/node 24.19.1.
- Beyond §3, with reasons:
  - @biomejs/biome: lint tool (decision 004).
  - parse5: HTML assertions in tests (§12 names it explicitly).
  - @hono/node-server: serves `example/server.ts` on Node; example only.
  - tsx: runs `example/server.ts` directly from TS sources (`.tsx` views included); example only. Node's built-in type stripping does not handle JSX (unverified).
  - @types/better-sqlite3, @types/node: types for tests and the example.

## Alternatives considered
- hono as a peerDependency: forces every consumer to install hono even when using `admin.fetch` only; a regular dependency with a caret range dedupes with the consumer's hono when compatible.
- node-html-parser / linkedom for tests (querySelector support): extra dependency not named in the spec; a small parse5 helper is enough.
- Building before running the example (`node example/server.ts` against `dist/`): slower feedback, two steps for the user.

## Rationale
Versions are those on npm on 2026-10-07 (evidence: 2026-10-07-toolchain-versions). The core set installs and works together under pnpm 12.10.0 on Node 24.21.0 (evidence: 2026-10-07-pnpm-mise-and-native-deps, 2026-10-07-ts7-vitest-biome-compat). tsx and @hono/node-server were not probed (unverified); phase 1 setup proves them.

## Consequences
- If tsx or @hono/node-server fail with this toolchain, the replacement needs a new decision.
