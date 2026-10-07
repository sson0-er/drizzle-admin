---
id: 11-views-layout-and-list-pages
depends_on: [10-views-format-url-static]
status: done
attempts: 0
---
# Task 11: views-layout-and-list-pages

## Goal
Hono JSX components for the layout, dashboard, list and error pages render from plain props with the stable selectors that tests use. A parse5-based HTML helper exists for tests.

## Scope
### Files to touch
- src/views/layout.tsx
- src/views/error.tsx
- src/views/dashboard.tsx
- src/views/list.tsx
- src/auth/flash.ts (new; only the type exports `FlashLevel`, `FlashMessage` and the constant `FLASH_COOKIE` in this task)
- test/helpers/html.ts
- test/views.test.ts (add render cases)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/views/format.ts, src/views/url.ts, src/static/** (task 10; bug fixes only, recorded in History)
- src/routes/**, every src/auth/** file other than flash.ts

## Implementation notes
- `PageChrome`, `Layout` structure, page props and stable selectors: `interfaces/views.md` sections "Layout and common props" and "Pages" (`DashboardPage`, `ListPage`, `ErrorPage`). `FlashMessage` / `FlashLevel` / `FLASH_COOKIE` are defined in `src/auth/flash.ts` exactly as in `interfaces/auth.md#flashts`; this task creates that file with only these exports, and task 12 adds `addFlash` / `consumeFlash`.
- All texts come from `messages`. No `raw()` or `dangerouslySetInnerHTML`.
- Every POST form contains `<input type="hidden" name="_csrf" value={csrfToken}>`.
- `ListPage`: search form (hidden when `q === null`), filter sidebar, action form posting to list URL + `backQuery`, `select[name=action]` only when `actions` is non-empty, `th[data-key][data-sort]` with `a.sort`, row checkboxes, `input#action-toggle` rendered with the `hidden` attribute, `<script>{SELECT_ALL_SCRIPT}</script>`, paginator (previous/next, up to 5 numbers around the current page, `messages.resultCount(total)`), `a.addlink` only when `canAdd`. Wrap the table in `div.results`.
- `test/helpers/html.ts`: `parse(html)`, `qsa(root, { tag, id?, cls?, attrs? })`, `qs`, `text(node)`, `attr(node, name)` on parse5 (test-strategy.md "Helpers").

## Definition of Done
- [ ] Tests: `test/views.test.ts` renders `Layout` and asserts `html[lang=ja]`, the stylesheet link `<prefix>/static/admin.css?v=<ADMIN_CSS_VERSION>`, `header#header`, `nav.breadcrumbs` with Home first, `ul.messagelist li.<level>` per flash message, and the logout form with a `_csrf` hidden input only when `showLogout` is true.
- [ ] Tests: `test/views.test.ts` renders `DashboardPage` and asserts `table#dashboard tr[data-model=<slug>]` with `a.changelink`, and `a.addlink` only when `canAdd`.
- [ ] Tests: `test/views.test.ts` renders `ListPage` and asserts the selectors listed for it in views.md (search form present/absent, `div[data-filter]` with `.selected`, `th[data-key]` with `data-sort`, `input[name=_selected][value]`, `input#action-toggle` with `hidden`, the `<script>` text equal to `SELECT_ALL_SCRIPT`, `p.paginator span.this-page`, `.result-count`, no `select[name=action]` when `actions` is empty).
- [ ] Tests: `test/views.test.ts` renders `ErrorPage` and asserts `h1` and `p.error-message`; a cell text `<script>alert(1)</script>` appears as text and the parsed tree has no `script` element besides the select-all script.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md#srcmessagests
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Helpers", row "views")
- Decisions: docs/orchestraude/decisions/007-static-assets.md, 004-biome-for-lint.md
- Evidence: 2026-10-07-hono-csrf-and-jsx

## History
