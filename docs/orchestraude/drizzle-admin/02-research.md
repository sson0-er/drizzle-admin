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
