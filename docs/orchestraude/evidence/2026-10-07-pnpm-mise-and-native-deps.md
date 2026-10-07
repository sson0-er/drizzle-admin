---
id: 2026-10-07-pnpm-mise-and-native-deps
question: How is pnpm provisioned, and does pnpm 12.10.0 need build-script approval for the native test dependencies?
source: mise.toml in repo; `mise exec -- pnpm --version`; `mise ls-remote pnpm` (mise 2026.10.3); scratch install with pnpm 12.10.0 on Node 24.21.0
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: mise.toml (edited by the user) pins `node = "24.21.0"` and `pnpm = "12.10.0"`; `pnpm --version` under mise prints 12.10.0. mise resolves pnpm via the aqua (pnpm/pnpm) and npm backends; 12.10.0 is the newest release mise shows (one newer is hidden by minimum_release_age).
Scratch `pnpm add -D` of typescript 7.0.2, vitest 5.0.3, @biomejs/biome 2.5.15, drizzle-orm 0.45.3, better-sqlite3 13.0.3, @electric-sql/pglite 0.5.8, hono 4.13.13, zod 4.6.5, parse5 8.0.1 succeeded with no build approval config. better-sqlite3 13.0.3 ships per-platform binaries in `prebuilds/` (no install script needed) and loaded fine; `PRAGMA foreign_keys` is 1 by default on a new connection.
Unknown: whether packages with a postinstall (e.g. esbuild via tsx) produce warnings or errors under pnpm 12 defaults (tsx/@hono/node-server not installed in the probe).
