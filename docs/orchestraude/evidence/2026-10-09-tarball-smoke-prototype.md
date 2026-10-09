---
id: 2026-10-09-tarball-smoke-prototype
question: For decision 052, does a packed tarball install and work in a clean consumer project, and can a consumer file be type-checked against the packed types?
source: local run in a scratch directory outside the repo; npm 11.19.0, node 24.21.0 (mise), tsc 7.0.2, package as of commit 73ffa95 (name still `drizzle-admin`)
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `npm pack --pack-destination <dir>` ran `prepack` (`pnpm build`) and produced a 188-file tarball: `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md` and `dist/**` (`.js`, `.d.ts`, `.js.map`, `.d.ts.map`). The maps point at `../src/*.ts`, which is not in the tarball.
- `npm install --ignore-scripts --no-audit --no-fund <tarball> drizzle-orm@0.45.3 hono@4.13.13 better-sqlite3@13.0.3 @electric-sql/pglite@0.5.8 typescript@7.0.2 @types/better-sqlite3@9.6.0 @types/node@24.19.1` in an empty `{"type":"module"}` project took about 9 s; zod came in as the package's dependency. better-sqlite3 13.0.3 has no install script and ships `prebuilds/*.node`, so `--ignore-scripts` is safe and loading worked.
- A consumer `.ts` (NodeNext, strict) importing `createAdmin` and `type AdminConfig` compiled with `skipLibCheck: true`; with `skipLibCheck: false` tsc reports dozens of errors inside drizzle-orm 0.45.3 (gel/mysql/singlestore declarations, missing `mysql2`/`gel`) and pglite 0.5.8 (`Emscripten` namespace), none in drizzle-admin.
- An unknown column key in `register(items, { listDisplay: ["nope"] })` is a type error against the packed types (TS2322), so `@ts-expect-error` there proves the types are not `any`.
- At runtime, with `auth.getUser`, GET `/admin/` and `/admin/items/` answered 200 and the list contained the seeded row, on better-sqlite3 (mounted with `app.route` in the consumer's own `Hono`) and on PGlite (`admin.fetch`).
- The mise-provided pnpm 12.10.0 is a standalone ELF executable, so it does not depend on the active Node version.
Not confirmed: the same run on Node 22 (not installed locally); behavior under the scoped name `@sson0-er/drizzle-admin` (only the tarball file name and the import specifier change).
