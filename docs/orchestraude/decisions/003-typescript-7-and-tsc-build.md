# 003: TypeScript 7.0.2 with a plain tsc build (ESM only)

- Date: 2026-10-07
- Status: accepted

## Context
`pnpm build` must produce publishable output (JS + type declarations). The latest TypeScript is 7.0.2. Research flagged compatibility of build tools with TS 7 as unverified.

## Decision
- typescript 7.0.2 (exact dev dependency).
- Build = `tsc -p tsconfig.build.json` emitting ESM `.js`, `.d.ts` and source maps into `dist/` (module/moduleResolution `nodenext`, relative imports written with `.js` suffix). No bundler.
- Package is ESM only (`"type": "module"`, `exports["."] = { types, import }`).

## Alternatives considered
- tsdown 0.23.0: peers TS ^7 but adds a bundler and its dts pipeline, which are not needed for a library without assets (not exercised).
- tsup 8.5.1: its dts generation depends on the TS compiler API; compatibility with TS 7 is unverified.
- TypeScript 5.9/6.x: would keep typescript-eslint available, but loses nothing we need from TS 7, and tsc 7 was verified end to end.
- Dual ESM/CJS output: extra configuration; hono and drizzle consumers can use ESM. Unverified demand.

## Rationale
tsc 7.0.2 emits .js + .d.ts with Hono JSX compiled to `hono/jsx/jsx-runtime` imports, so consumer tsconfig does not matter. The §5.2 `ColumnKey` type errors work under TS 7. vitest 5 resolves `.js` specifiers to TS sources (all evidence: 2026-10-07-ts7-vitest-biome-compat).

## Consequences
- CSS must be a TS module, because tsc does not copy or inline assets (see decision 007).
- Stale files in `dist/` are removed by a clean step in the build script.
