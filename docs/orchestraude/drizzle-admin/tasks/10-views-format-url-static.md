---
id: 10-views-format-url-static
depends_on: [08-db-helpers-and-repository]
status: done
attempts: 0
---
# Task 10: views-format-url-static

## Goal
List cell values are formatted by the ordered rules, list URLs are built while preserving other query parameters, the header sort cycle works, and the base stylesheet and the select-all script exist as string modules.

## Scope
### Files to touch
- src/views/format.ts
- src/views/url.ts
- src/static/admin-css.ts
- src/static/select-all.ts
- test/format.test.ts
- test/views.test.ts (new; url, script and CSS cases)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/time.ts, src/data/**, src/introspect/**

## Implementation notes
- `formatValue` / `formatCell` / `TRUNCATE_AT`: `interfaces/views.md#formatts`. Apply rules 1-10 in the stated order (first match wins). Rule 5 applies only to `Date` values with `isDateOnly`; a date-only string falls through to rule 10 unchanged. Truncate default-formatted strings longer than 100 chars to the first 100 + `…`. A formatter's string is returned as is (escaping happens in JSX).
- `withQuery(base, current, changes)`: copy `current`, apply changes (`null` deletes), delete `p` unless `p` is in `changes`; an empty query returns `base` only.
- `sortHref`: define the signature yourself (e.g. `sortHref(base, current, key, state)`). Implement the cycle of decision 013 item 5: not sorted → `o=k` → `o=-k` → no `o`; other sort keys are dropped; `p` is dropped.
- `ADMIN_CSS`: system font stack, no `url(` to external resources, no `@import`, a Django-like palette as CSS custom properties on `:root`, header / breadcrumbs / content areas, filter sidebar `#changelist-filter` on the right, `.results { overflow-x: auto }`, visible styles for `.errornote`, `.errorlist`, `.messagelist .success/.warning/.error`. The dark-mode (`prefers-color-scheme: dark`) and `max-width: 767px` media queries are added in task 25 (phase 6), not here.
- `ADMIN_CSS_VERSION`: FNV-1a 32-bit hex of `ADMIN_CSS`, computed at module load.
- `SELECT_ALL_SCRIPT`: the example body in views.md; it must not contain `&`, `<`, `>`, `"` or `'` (decision 007).

## Definition of Done
- [ ] Tests: `test/format.test.ts` covers each rule 1-10 in order: formatter output returned as is (including `<b>`), null → `-`, numeric FK with `fkLabel` → the label, booleans → `✓`/`✗`, date-only UTC midnight → `2026/10/07` under both `Asia/Tokyo` and `America/New_York`, timestamp → `formatDateTime`, json → `JSON.stringify`, bigint/number → `String`, `Uint8Array` → `[binary]`, date-only string `"2026-10-07"` → `2026-10-07`; a 101-char string → 100 chars + `…`.
- [ ] Tests: `test/views.test.ts` covers `withQuery` (preserves other params, `null` deletes, drops `p` unless changed, empty query → base) and the sort cycle none → asc → desc → none with other keys and `p` dropped.
- [ ] Tests: `test/views.test.ts` asserts `SELECT_ALL_SCRIPT` contains none of `& < > " '`, `ADMIN_CSS` contains no `url(http` and no `@import`, and `ADMIN_CSS_VERSION` matches `/^[0-9a-f]{8}$/`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (sections "url.ts", "format.ts", "Static modules")
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "views")
- Decisions: docs/orchestraude/decisions/007-static-assets.md, 013-unspecified-page-behaviors.md (items 5, 6), 019-date-only-calendar-dates.md, 023-pg-date-string-mode-support.md
- Evidence: 2026-10-07-hono-routing-cookies-script-escaping

## History
