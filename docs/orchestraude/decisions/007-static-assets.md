# 007: CSS as a TS string module; inline select-all script with a restricted character set

- Date: 2026-10-07
- Status: accepted

## Context
§4/§11: a single CSS file "embedded as a string and served from a route", no frontend build. §10 forbids `raw` / `dangerouslySetInnerHTML`. §11 allows one small inline script for the "select all" checkbox. The build is plain tsc (decision 003), which neither copies nor inlines `.css` files.

## Decision
- The stylesheet is authored in `src/static/admin-css.ts` as `export const ADMIN_CSS = \`...\``, plus `ADMIN_CSS_VERSION` (FNV-1a hash of the string, hex) used as `?v=` for cache busting. This is a file-name deviation from §4 (`static/admin.css`).
- The select-all script is a constant whose source uses no `& < > " '` characters (template literals instead of quotes). It is rendered as a normal JSX `<script>` child. A unit test asserts that the rendered `<script>` text equals the constant, i.e. that nothing was escaped.

## Alternatives considered
- Keep `src/static/admin.css` and generate a TS module with a pre-build script: an extra build step that must run before typecheck, test and build.
- Serve `/static/admin.js` instead of an inline script: adds a route not listed in §8 and contradicts "inline script".
- `raw()` for the constant script: explicitly forbidden by §10, even though the content is constant.

## Rationale
tsc does not handle CSS assets (evidence: 2026-10-07-ts7-vitest-biome-compat). Hono JSX escapes `<script>` children, turning `"` into `&quot;` and `&&` into `&amp;&amp;` (evidence: 2026-10-07-hono-routing-cookies-script-escaping), so a script with those characters would break.

## Consequences
- CSS edits happen in a TS file (Biome formats it as TS, not as CSS).
- The script must avoid comparisons and logical operators that use `<`, `>` or `&`.
