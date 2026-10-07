# Decisions and evidence

## Decisions taken
Changed 2026-10-07: added 014-017 (answers to Q1-Q4); 008 updated to point to them. Review revision: added 018-022; 009 updated to point to 018 and 019.
Changed 2026-10-07: added 023 (answer to Q5); 010 and 019 updated to point to it.
Changed 2026-10-07: added 025 (correction found in task 02-support-time: `zonedToInstant` algorithm text).
Changed 2026-10-07: added 026 (user answer to the SQLite blob-bigint question from task 03-introspect).

(Files in `docs/orchestraude/decisions/`.)
- 001-pnpm-provisioned-via-mise: pnpm 12.10.0 via mise.toml, pinned by the user; no `packageManager` field; no task edits mise.toml.
- 002-drizzle-version-policy: peer `drizzle-orm ^0.45.3`, dev exact `0.45.3`.
- 003-typescript-7-and-tsc-build: TypeScript 7.0.2, plain `tsc` ESM build with `.d.ts`, no bundler.
- 004-biome-for-lint: Biome 2.5.15; typescript-eslint is incompatible with TS 7; reasoned `biome-ignore` for boundary `any`.
- 005-dependency-set: hono/zod as dependencies; dev dependencies pinned; reasons for those beyond §3 (biome, parse5, @hono/node-server, tsx, @types/*).
- 006-routing-and-mounting: relative routes mounted at basePath, `/*` catch-all for the dashboard/trailing slash, lazy build + registry freeze, reserved slugs, `src/routes/` layout.
- 007-static-assets: CSS as `src/static/admin-css.ts`; inline select-all script without escapable characters.
- 008-session-csrf-flash: hono signed cookies, anonymous session for the login token, fixed expiry, separate flash cookie (external mode: 014; proxy: 017).
- 009-search-filter-sql: `escapeLike`, PG `ilike` (with `::text`, 018), SQLite `like ... escape '\'`, date preset ranges (date-only bounds: 019).
- 010-fieldmeta-kind-mapping: FieldMeta additions (isInteger, isLongText, isDateOnly, isGenerated), kind/PK/FK/auto-increment rules.
- 011-db-error-classification: classify by code along `.cause`; fixed messages only.
- 012-db-config-typing: keep `db: unknown` as in §5.2.
- 013-unspecified-page-behaviors: view-only change page, PK read-only on change, defaults, query parameters, external-mode login/logout, hook error handling, extra register checks.
- 014-external-auth-csrf-token: external (`getUser`) mode keeps the CSRF token in the same signed `da_session` cookie with `u: null` (Q1).
- 015-hookctx-definition: `HookCtx = { mode: "add" | "change" | "delete"; user; db }`, no `request` (Q2).
- 016-custom-action-permission: custom actions require `change`; built-in delete keeps `delete` (Q3).
- 017-public-origin: public API addition `AdminConfig.publicOrigin` for the Origin check and cookie `Secure` flag behind reverse proxies (Q4).
- 018-pg-search-text-cast: PG search uses ``ilike(sql`${col}::text`, pattern)`` for every column, so uuid/numeric/pgEnum/date search fields work.
- 019-date-only-calendar-dates: date-only values are UTC-midnight Dates; the time zone only determines "today" for presets (`calendarPresetRange`).
- 020-hono-csrf-origin-equality-by-test: user decision; exact-equality Origin comparison is proven by implementation tests; a deviation blocks the task.
- 021-widget-override-compatibility: `allowedWidgets` per field kind checked by `register()`; data handling never depends on the widget.
- 022-unmatched-routes-and-error-rendering: all-methods fallback route for 404, HTML 403 for the Origin check, full logging for non-DB errors.
- 023-pg-date-string-mode-support: PG `date()` string mode keeps kind string, gets `isDateOnly`, the `date` widget and date-preset filters with `YYYY-MM-DD` string values and string bounds (Q5).
- 025-zoned-to-instant-dst-algorithm: `zonedToInstant` takes candidates from the offsets one day before and after the guess, returns the earliest that round-trips (overlap → first occurrence), else the later candidate (gap → later valid instant); replaces the single-pass correction, which contradicted those outcomes.
- 026-sqlite-blob-bigint-support: SQLite bigint columns are `blob({ mode: "bigint" })` and stay kind `bigint`; ordering and range comparison on them are bytewise (documented limitation), equality works; SQLite tests must not assume numeric order or range filtering on them.

## Evidence referenced
- 2026-10-07-drizzle-orm-release-lines (research)
- 2026-10-07-drizzle-column-introspection (research)
- 2026-10-07-hono-csrf-and-jsx (research)
- 2026-10-07-toolchain-versions (research)
- 2026-10-07-pnpm-mise-and-native-deps (design): mise pins pnpm 12.10.0; better-sqlite3 13 ships prebuilds; foreign_keys on by default.
- 2026-10-07-ts7-vitest-biome-compat (design): tsc 7 emit, vitest 5 + Hono JSX, typescript-eslint peer < 6.1, Biome suppression reasons.
- 2026-10-07-hono-routing-cookies-script-escaping (design): mounted root vs trailing slash, route precedence, signed cookies, script escaping.
- 2026-10-07-drizzle-driver-runtime-behavior (design): returning/count on both drivers, error shapes, SQLite LIKE ESCAPE.
- 2026-10-07-drizzle-column-variants (design): columnType names, identity/generated flags.
- 2026-10-07-hono-csrf-origin-option (design, Q4): `csrf({ origin })` accepts a fixed origin; OR-combined with the Sec-Fetch-Site check. Exact equality unverified (decision 020).
- 2026-10-07-drizzle-pg-date-mapping (design revision): PgDate writes `toISOString()`, reads `YYYY-MM-DD` as UTC midnight; a Tokyo-midnight Date is stored as the previous day.
- 2026-10-07-pg-search-non-text-columns (design revision): PG `ilike` fails (42883) on uuid/numeric/interval/date/string-timestamp/pgEnum; `::text` cast fixes it; SQLite LIKE works on numeric; `DrizzleQueryError` needs `instanceof`.
- 2026-10-07-pg-date-string-mode-filtering (design, Q5): `YYYY-MM-DD` string bounds filter `date()` columns exactly under any process TZ; PG rejects `2026-02-30` (22008) but accepts `2026/10/07`.
- 2026-10-07-zoned-to-instant-dst-algorithm (design correction, decision 025): the single-pass correction gives 06:30Z for the New York gap and 01:30Z for the Berlin overlap; src/time.ts gives the expected 07:30Z / 05:30Z / 01:30Z / 00:30Z and its tests pass under any process TZ. Expires 2027-01-05.
- 2026-10-07-sqlite-blob-bigint-ordering (design, decision 026): SQLite `integer()` has no bigint mode; `blob({mode:"bigint"})` stores decimal digits as BLOB bytes; `order by` is bytewise (-5, 10, 100, 9), a numeric bound matches every row, equality works. Expires 2027-01-05.

All other entries expire 2026-11-06. Re-verify any expired entry before relying on it.
