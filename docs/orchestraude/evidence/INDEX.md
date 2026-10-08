# Evidence index

One line per entry: `- <id> | <question> | expires <yyyy-mm-dd>`

- 2026-10-07-drizzle-orm-release-lines | Which drizzle-orm release line is the latest stable, and what are its peer deps? | expires 2026-11-06
- 2026-10-07-drizzle-column-introspection | What Column/getTableConfig properties does drizzle-orm 0.45.3 expose for introspection (sqlite and pg)? | expires 2026-11-06
- 2026-10-07-hono-csrf-and-jsx | How do hono/csrf and hono/jsx behave (Origin check, escaping, tsconfig)? | expires 2026-11-06
- 2026-10-07-toolchain-versions | Which current versions of toolchain packages exist and do they work on Node 24.21.0? | expires 2026-11-06
- 2026-10-07-pnpm-mise-and-native-deps | How is pnpm provisioned, and does pnpm 12.10.0 need build-script approval for native test deps? | expires 2026-11-06
- 2026-10-07-ts7-vitest-biome-compat | Can TypeScript 7, vitest 5 and a lint tool work together for typecheck, test, lint and build? | expires 2026-11-06
- 2026-10-07-hono-routing-cookies-script-escaping | How do Hono sub-app mounting, trailing slashes, signed cookies and JSX script children behave? | expires 2026-11-06
- 2026-10-07-drizzle-driver-runtime-behavior | How do drizzle 0.45.3 better-sqlite3/pglite drivers behave for returning, count, LIKE escaping, constraint errors? | expires 2026-11-06
- 2026-10-07-drizzle-column-variants | What dataType/columnType do further drizzle 0.45.3 column variants report? | expires 2026-11-06
- 2026-10-07-hono-csrf-origin-option | Can hono/csrf be configured to compare Origin with a fixed public origin (for AdminConfig.publicOrigin)? | expires 2026-11-06
- 2026-10-07-drizzle-pg-date-mapping | How does drizzle 0.45.3 map PG date columns (mode date/string), and does the time zone shift date-only values? | expires 2026-11-06
- 2026-10-07-pg-search-non-text-columns | Does PG ilike work on non-text string-kind/pgEnum columns, does ::text fix it, does SQLite LIKE work on numeric? | expires 2026-11-06
- 2026-10-07-pg-date-string-mode-filtering | Do YYYY-MM-DD string bounds filter PG date() string-mode columns, and how does PG treat malformed date strings? | expires 2026-11-06
- 2026-10-07-zoned-to-instant-dst-algorithm | Does the support.md zonedToInstant algorithm give the stated DST gap/overlap outcomes, and does src/time.ts? | expires 2027-01-05
- 2026-10-07-sqlite-blob-bigint-ordering | How are SQLite blob({mode:"bigint"}) values stored, and are ordering/range/equality comparisons numeric? | expires 2027-01-05
- 2026-10-08-trailing-slash-open-redirect | Can the trailing-slash catch-all redirect off-site with basePath "/", and does task 14 code (renderPage, buildApp, catch-all) match the design? | expires 2027-01-06
- 2026-10-08-trailing-slash-control-char-bypass | Does the decision 029 denylist still redirect off-site via control characters, and how do Hono routes and browsers treat such paths? | expires 2027-01-06
- 2026-10-08-formpage-timezone-prop | Which props does the task 18 FormPage take, and why does it need a time zone? | expires 2027-01-06
- 2026-10-08-confirm-action-listhref-prop | Which props does the task 21 ConfirmActionPage take, and how does the actions route fill them? | expires 2027-01-06
- 2026-10-08-safenext-decoded-path | For login `next` validation, how do WHATWG URL parsing, decodeURIComponent and Hono's `c.req.path` treat encoded dot segments, `%2F`, spaces and malformed escapes? | expires 2027-01-06
- 2026-10-08-hono-head-cookie-body-node-server | How do Hono 4.13.13 and @hono/node-server 2.1.3 treat HEAD (c.req.method), deleteCookie attributes, parseBody size and the listen hostname? | expires 2027-01-06
