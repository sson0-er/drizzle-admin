# Decisions and evidence

## Decisions taken
Changed 2026-10-07: added 014-017 (answers to Q1-Q4); 008 updated to point to them. Review revision: added 018-022; 009 updated to point to 018 and 019.
Changed 2026-10-07: added 023 (answer to Q5); 010 and 019 updated to point to it.
Changed 2026-10-07: added 025 (correction found in task 02-support-time: `zonedToInstant` algorithm text).
Changed 2026-10-07: added 026 (user answer to the SQLite blob-bigint question from task 03-introspect).
Changed 2026-10-08: added 027-029 (user decisions after task 14: `renderPage` flash callback, `buildApp` return type, trailing-slash open-redirect guard); 006 updated to point to 029.
Changed 2026-10-08: 029 amended to an allowlist after a tab-character bypass; evidence 2026-10-08-trailing-slash-control-char-bypass added.
Changed 2026-10-08: 029 amended again: whitespace excluded; decoded LF/CR 404 accepted as a known limitation (Q6).
Changed 2026-10-08: added 030 (task 18 gap: `FormPage` `timeZone` prop, `values` / `displayRow` split); evidence 2026-10-08-formpage-timezone-prop added.
Changed 2026-10-08: added 031 (task 21 gap: `ConfirmActionPage` `listHref` prop); evidence 2026-10-08-confirm-action-listhref-prop added.
Changed 2026-10-08: added 032 (user decision after the task 22 review: `safeNext` raw and decoded path rules); evidence 2026-10-08-safenext-decoded-path added.
Changed 2026-10-08: 032 amended: dot segments resolved by URL parsing are accepted in normalized form (user answer).
Changed 2026-10-08: added 033-038 (user answers to the low-findings triage section B and three follow-ups); 013 item 11, 017 and 021 carry notes pointing to them; evidence 2026-10-08-hono-head-cookie-body-node-server added.
Changed 2026-10-08: 037 extended to list cells (Q7 option (b)); 035 confirmed by the user.

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
- 024-allow-esbuild-build-script: `pnpm-workspace.yaml` allows only esbuild's build script, so `pnpm install` exits 0 (task 01). (Changed 2026-10-08: entry was missing from this list.)
- 025-zoned-to-instant-dst-algorithm: `zonedToInstant` takes candidates from the offsets one day before and after the guess, returns the earliest that round-trips (overlap → first occurrence), else the later candidate (gap → later valid instant); replaces the single-pass correction, which contradicted those outcomes.
- 026-sqlite-blob-bigint-support: SQLite bigint columns are `blob({ mode: "bigint" })` and stay kind `bigint`; ordering and range comparison on them are bytewise (documented limitation), equality works; SQLite tests must not assume numeric order or range filtering on them.
- 027-render-page-flash-callback: `renderPage` accepts `JSX.Element | ((flash) => JSX.Element)`; flash is consumed only for 200/400 non-minimal pages and passed to the function form, so 200/400 pages show the consumed messages.
- 028-build-app-plain-hono: `buildApp(state): Hono`; built as `Hono<AdminEnv>` and cast, because `Admin.app` is a public plain `Hono`.
- 029-trailing-slash-redirect-guard: the catch-all redirects only when the path after the prefix is empty or a single leading `/` followed by non-empty segments with no `\`, control character or whitespace (allowlist; the first denylist version was bypassed with `%09`); otherwise 404 without `Location`; paths with a decoded LF/CR get Hono's / the host's plain 404 (accepted known limitation, no `notFound` handler); every `Location` is a single-slash path under the prefix (open redirect with basePath "/", task 14 review).
- 030-formpage-timezone-prop: `FormPage` takes a required `timeZone` (display-only date-times via `DisplayValue`); `values` are form strings for editable fields, `displayRow` is the stored row for display-only fields; add/change handlers pass `state.config.timeZone`, change also passes `displayRow: row` (task 18 implementation adopted).
- 031-confirm-action-listhref-prop: `ConfirmActionPage` takes a required `listHref` (list URL; `PageChrome` has no model slug); the form and cancel link use `listHref + backQuery`; the actions handler passes `listHref: listUrl` and `backQuery` on both confirmation renders (task 21 implementation adopted).
- 032-safenext-decoded-path-rules: `safeNext` additionally rejects decoded control characters and `\`, raw `//` in the path, malformed percent escapes and decoded `.`/`..` segments that survive URL normalization (literal `/admin/./x`, `/admin/a/../b/` are normalized and accepted); decoded whitespace (`/admin/kv/a%20b/change/`) and encoded `%2F`/`%2F%2F` stay allowed (consistent with 029); returns the still-encoded normalized path; the auth guard passes the raw `new URL(c.req.url).pathname` as `next` (user decision, task 22 review).
- 033-low-findings-recorded-behaviors: implemented behaviors kept and recorded (L055, L057-L061, L064-L066, L068-L071, L073, L075-L077): several flash Set-Cookie headers, `create` no-row error, vanished-rows `noSelection`, `listDisplayLinks` over FK link, FK filter value outside the choices, `?? []` fkChoices fallback, logged-out HEAD treated like GET (needs a code change), `data-sort` from explicit `o` only, display-only hidden rows, non-DB create/update errors are 500s, glyph literals exempt from messages, `rawValues` booleans, failed finalization retried, JSON truncation, `describeForLog` levels, whitespace-only numbers rejected.
- 034-fk-reference-view-permission: without `view` on the referenced model, list FK cells show raw values (no link, no label query), the FK filter is not offered (`f_<key>` ignored), and add/change FK fields are plain key inputs (`"noView"`), no related-list link (L047, L048).
- 035-field-labels: `fieldLabel(key)` humanizes keys (`authorId` → `Author id`); used for list column headers, filter headings and `FormField.label` (L067).
- 036-triage-behavior-changes: `tooMany` link only for default/`select` widgets (L062); cookie deletions carry the same attributes incl. `Secure` (L072); custom confirm action with no surviving rows → `noSelection` (L003); single delete removing 0 rows → `alreadyDeleted` warning (L074).
- 037-password-widget-no-echo: the `password` input renders empty; empty on change keeps the stored value (zod optional, not required); display-only password fields and list cells masked as `********` (Q7 option (b)); amends 013 item 11 and 021.
- 038-body-size-and-example-bind: no in-library body limit in v1, README tells deployers to limit it at the proxy; the example binds to `127.0.0.1` unless `HOST` is set.

## Evidence referenced
Changed 2026-10-08: 2026-10-08-hono-head-cookie-body-node-server added (decisions 033, 036, 038).
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
- 2026-10-08-trailing-slash-open-redirect (design, decisions 027-029): with prefix `""` the old catch-all redirected `//evil.example` and `/%5Cevil.example` off-site; the fixed rule returns 404 without Location for basePath "/" and "/admin" while ordinary paths still 301; task 14 `renderPage` / `buildApp` signatures confirmed. Expires 2027-01-06.
- 2026-10-08-trailing-slash-control-char-bypass (design, decision 029 amendment): Hono decodes `%09` to a tab and the denylist redirected to `/\t/evil.example/`, which WHATWG URL parsing resolves to `https://evil.example/`; Hono's `/*` and `*` middleware do not match decoded LF/CR paths (Hono or host 404); a mounted sub-app's `notFound` is ignored; the allowlist gives 404 without `Location` for the attack paths and 301 for `/users?a=1`. Expires 2027-01-06.
- 2026-10-08-formpage-timezone-prop (design, decision 030): task 18 `FormPageProps` include a required `timeZone`; editable fields read `values`, display-only fields read `displayRow` through `DisplayValue` = `formatValue(meta, value, timeZone)`. Expires 2027-01-06.
- 2026-10-08-confirm-action-listhref-prop (design, decision 031): task 21 `ConfirmActionPageProps` include a required `listHref`; the form posts to `${listHref}${backQuery}`; `actionsHandler` passes `listHref: listUrl, backQuery` on both confirmation renders. Expires 2027-01-06.
- 2026-10-08-hono-head-cookie-body-node-server (design, decisions 033, 036, 038): Hono routes HEAD through GET routes but `c.req.method` stays `HEAD` (the auth guard currently gives HEAD `next = <prefix>/`); `deleteCookie` passes all options (incl. `Secure`) to the `Max-Age=0` Set-Cookie; `parseBody` buffers the whole body with no limit (Hono has a separate `body-limit` middleware); `@hono/node-server` `serve` listens on `hostname`. Expires 2027-01-06.
- 2026-10-08-safenext-decoded-path (design, decision 032): `new URL` resolves literal and `%2e` dot segments but not `..%2Fx`, which `decodeURIComponent` turns into `/admin/../x`; `%20` and `%2F%2F` stay encoded in the pathname; malformed escapes throw `URIError`; Hono `c.req.path` decodes `%20`/`%09`/`%5C` but keeps `%2F`. Expires 2027-01-06.

All other entries expire 2026-11-06. Re-verify any expired entry before relying on it.
