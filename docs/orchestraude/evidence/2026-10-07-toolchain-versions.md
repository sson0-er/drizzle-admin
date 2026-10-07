---
id: 2026-10-07-toolchain-versions
question: Which current versions of toolchain packages exist and do they work on Node 24.21.0?
source: npm view <pkg> version/engines on 2026-10-07; probe install in scratchpad
fetched: 2026-10-07
expires: 2026-11-06
---
Learned (latest on npm): hono 4.13.13, zod 4.6.5, vitest 5.0.3 (node ^22.12||^24||>=26; vite peer ^6.4||^7||^8), better-sqlite3 13.0.3 (node >=22, ships prebuilds; in-memory query ran on Node 24.21.0, SQLite 3.53.4), @electric-sql/pglite 0.5.8, typescript 7.0.2 (latest), parse5 8.0.1, tsup 8.5.1, tsdown 0.23.0, eslint 10.12.0, @biomejs/biome 2.5.15, @hono/node-server 2.1.3, tsx 4.23.15, pnpm 12.9.1 on registry. pnpm is NOT installed on this machine (corepack 0.36.0 is present with Node). Unknown: whether the above are mutually compatible (vitest 5 + TS 7, tsup/tsdown with TS 7, zod 4 API vs spec), whether pnpm 12 blocks dependency build scripts by default (unverified).
