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

## Post-v1: Digital Agency design system

Scope (user, narrowed): make the existing UI feel closer to DADS (look and feel). Keep our own markup, selectors, single stylesheet (`src/static/admin-css.ts`), inline SVG icons (decision 039), `prefers-color-scheme` dark mode, no external fonts, no JS. Not adopting DADS components, class names, or JS.

### License and attribution
- Snippets repo and `@digital-go-jp/design-tokens` are MIT (Copyright Digital Agency); copying their CSS/tokens into an MIT package is permitted if the MIT notice is kept when copied substantially (evidence: 2026-10-08-dads-license-notices).
- The notices page says edited/processed snippet-derived UI used on the user's own site needs no attribution; only unmodified published use requires a citation. Guidelines text itself (design system body) requires a source credit, and processed content must not appear to be made by the Digital Agency (evidence: 2026-10-08-dads-license-notices).
- Color hex, px sizes and ratios are plain values; writing our own CSS "inspired by" them copies no code. Whether bare values are copyrightable is a legal question, not answered (unverified). Safe course: write our own CSS using the values; if any CSS block is pasted verbatim, add the MIT notice to the package's third-party notices. Do not use DA logos/branding.
- Font: Noto Sans is OFL 1.1; bundling would need the license text and font must not be sold alone (evidence: 2026-10-08-dads-license-notices). Irrelevant if we do not ship the font.

### Traits that give the DADS feel (all values from evidence: 2026-10-08-dads-design-tokens-package, 2026-10-08-dads-html-snippets-repo)
- Primary (key) blue: blue-900 #0017c1 (buttons, links; hover blue-1000 #00118f, active blue-1200 #000060); tints blue-50 #e8f1fe, -100 #d9e6ff, -200 #c5d7fb, -300 #9db7f9. Links: blue-1000 underlined (1px, 3px on hover, offset 3px); visited magenta-900 #8b008b; active orange-800 #c74700.
- Neutrals: text gray-800 #333333, strong text gray-900 #1a1a1a, input border gray-600 #666666, table border/disabled gray-420 #949494, muted gray-536 #767676, disabled bg gray-50 #f2f2f2, gray-100 #e6e6e6, gray-300 #b3b3b3; white page/background.
- Semantic: error red-800 #ec0000 (hover/dark red-900 #ce0000, red-1000 #a90000); success green-800 #197a4b (green-600 #259d63); warning yellow-900 #927200 with chip yellow-400 #ffc700; orange-800 #c74700; info blue-900 or gray-536.
- Typography: Noto Sans JP, weights 400/700 only; body 16px, line-height 1.7, letter-spacing 0.02em; dense/table 14-16px, line-height 1.2-1.3; headings bold, 1.5 line-height, sizes 20/22/24/26/28/32/36px (letter-spacing 0.02em up to 20-26px, 0.01em at 28-36px); page text is larger and airier than our current 14px.
- Radius: 4, 6, 8 (buttons/inputs), 12 (notifications), 16 px. Elevation shadows exist (e.g. `0 2px 8px 1px rgba(0,0,0,.1), 0 1px 5px rgba(0,0,0,.3)`), used sparingly; the look is flat with strong borders.
- Spacing: no spacing tokens; components use a 4px-based set: 4, 8, 12, 16, 20, 24, 32 px. Control heights: input 40/48/56, button 28/36/48/56 px; min touch area 44px.
- Focus ring: 4px solid black outline, 2px offset, 4px radius, plus 2px #ffd43d (yellow-300) halo; text buttons also fill yellow (evidence: 2026-10-08-dads-a11y-focus-contrast).
- Buttons: solid fill (blue-900, white bold text, 4px double transparent border, underline on hover), outline (1px currentcolor border, white bg, blue text; hover bg blue-200), text (underlined, no border). Radius 8px at md/lg. No red/danger variant exists in DADS snippets, so destructive styling must be our own (e.g. red-800/900 with the same shape) (unverified fit; not in DADS).
- Inputs: white bg, 1px gray-600 border, 8px radius, 16px text, black border on hover, invalid = red-800 border plus red error text below; read-only = dashed border; labels with a "※必須" requirement marker.
- Tables: borderless-ish, 1px gray-420 row dividers, cell padding 20/16px (dense 12/16px), bold header cells, optional zebra stripe; no heavy header fill.
- Notifications: white card, 3px border in semantic color, 12px radius, left-aligned semantic icon (24-44px), bold 17px heading; color-chip variant has a thick left inset bar (8px mobile, 16px desktop).
- Contrast of these pairs on white: blue-900 11.1:1, red-800 4.6, red-900 5.79, green-800 5.35, yellow-900 4.54, gray-600 5.74, gray-800 12.63; gray-420 borders are only 3.03:1 (OK for non-text 3:1) (evidence: 2026-10-08-dads-a11y-focus-contrast).

### Fonts
- DADS declares `'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif` and its examples load Noto Sans JP from Google Fonts; there is no self-hosted file and no official system fallback beyond that (evidence: 2026-10-08-dads-html-snippets-repo, 2026-10-08-dads-design-tokens-package). Requirement §11 forbids external fonts, so we can only reference `"Noto Sans JP"` as a locally installed name and must keep our system-ui stack with Japanese system fonts (e.g. "Hiragino Sans", "Yu Gothic", Meiryo) as the effective face; exact stack is a design decision. Glyph metrics differ from Noto Sans JP, so line-height 1.7 may need review (unverified).

### Dark mode
- DADS defines no dark-mode colors: no dark tokens in the tokens package, no `prefers-color-scheme` in the snippets (only `color-scheme` on modal backdrops) (evidence: 2026-10-08-dads-design-tokens-package). The website guideline pages were not checked for a written policy (unverified). We must derive our own dark palette: e.g. keep the same hue family, use light tints (blue-200/300) for links and primary, red-300/400 for errors, and verify contrast ourselves; the DADS yellow/black focus ring needs a dark-mode variant.

### Risks and constraints
- DADS is beta (site v2.18.0, snippets tagged weekly), so values may drift; copying values freezes a snapshot (evidence: 2026-10-08-dads-html-snippets-repo).
- Their palette is light-only; blue-900 on dark backgrounds fails contrast, so our dark mode is original work.
- Larger text (16px/1.7) and 40-48px controls enlarge tables/forms; interacts with the <768px responsive rules and the density of list/tables.
- Underlined links and black+yellow focus ring change the visual identity noticeably; decision 039 icons use stroke-based inline SVG and are unaffected, but icon colors need re-checking against the new palette (3:1).
- No DADS red button, sidebar, header, or numbered pagination exists to copy; those parts follow our own design.

### Evidence referenced
- 2026-10-08-dads-license-notices
- 2026-10-08-dads-html-snippets-repo
- 2026-10-08-dads-design-tokens-package
- 2026-10-08-dads-a11y-focus-contrast
- 2026-10-08-dads-icon-terms (icons: DADS has no icon font/sprite; its inline SVGs use `currentcolor` and `aria-hidden`, matching decision 039; Figma icons are partly Material Symbols, Apache 2.0)
