---
id: 15-routes-list
depends_on: [14-routes-app-shell, 11-views-layout-and-list-pages]
status: done
attempts: 1
---
# Task 15: routes-list

## Goal
`GET /:model/` renders the list page: search, filters (boolean / enum / FK / date presets incl. date-only values), header ordering, pagination, value formatting, FK links and labels without N+1 queries, and the action dropdown. Error rendering and logging work for list-time failures. This completes phase 2.

## Scope
### Files to touch
- src/routes/list.ts
- src/routes/index.ts (register route 4 `GET /:model/` in table order)
- test/list.test.ts
- test/example.test.ts (add the phase-2 part)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/routes/middleware.ts, src/routes/context.ts (bug fixes only, recorded in History)
- src/data/**, src/views/**, src/auth/** (bug fixes only, recorded in History)
- test/helpers/**, test/fixtures/**

## Implementation notes
- Handler steps 1-7: `interfaces/routes-handlers.md` section "List". Query parsing per decision 013 item 6 (`q` only when `searchFields` is non-empty; `o` keeps only `listDisplay` keys, deduped, default `M.ordering`, then `[{ key: pk, desc: true }]`; `f_<key>` only for `listFilter` keys; `p` integer ≥ 1 else 1).
- FK labels: for each `listDisplay` key with `foreignKey.slug` and no formatter, one `repo.getMany` per column; cells link to `${prefix}/<refSlug>/<enc(pk)>/change/`. `listDisplayLinks` cells link to the row's change page.
- Filter choices: boolean (all / `1` / `0`), enum (all + values), kind date or `isDateOnly` (all + today / past7 / month / year), FK (all + `repo.options(refMeta, { limit: 200, ordering: ref.ordering, toLabel: ref.toString })`). Links use `withQuery`, keep other params and drop `p`.
- Actions: `delete_selected` (label `messages.deleteSelected`) if `can(M, "delete", U)`, plus custom actions if `can(M, ACTION_PERMISSION, U)`. The action form posts to list URL + current search string (the POST handler is task 21).
- Permission checks (`view` → 403) are implemented here; the permission test matrix is in task 24 (`test/auth.test.ts`) and is not required in this task.
- Cell values: `formatCell` (task 10) with `state.config.timeZone`.

## Definition of Done
- [ ] Tests: `test/list.test.ts` (`describe.each(dialects)`) verifies: list 200 with `table#result_list`; unknown model → 404; search with a wildcard literal (`%`) matches only literal rows; `q` ignored when `searchFields` is empty (search form absent); each filter kind (boolean, enum, FK, date preset) filters rows, marks the active choice `.selected`, and its links preserve other params (`q`, `o`); header cycle asc → desc → off via `th[data-key] a.sort` hrefs and `data-sort`; `o` on a non-listDisplay key is ignored; pagination (`p`, `span.this-page`, `.result-count` total); `✓`/`✗`; `-` for null; FK cell links to the author's change page with the author's `toString`; truncation with `…`.
- [ ] Tests: `test/list.test.ts` verifies no N+1: `queryCount()` for an `articles` list page with 30 rows (FK `authorId` in `listDisplay`) equals the count for a page with 3 rows.
- [ ] Tests: `test/list.test.ts` (PG only, `events`) verifies search with `searchFields` code/amount/mood → 200 with the matching rows; a date-only `day` cell shows `2026/10/07`; a `due` cell shows `2026-10-07`; with `listFilter: ["due"]` the sidebar offers the date presets and `f_due=today` lists only the row whose `due` is today in `timeZone` (rows inserted for that date and the day before, computed with `toDateOnly(calendarPresetRange("today", new Date(), tz).start)`), for `Asia/Tokyo` and `America/New_York`.
- [ ] Tests: `test/list.test.ts` verifies with `console.error` spied: a throwing `formatters` function → 500 and the log contains its message; registering `kv` with `searchFields: ["value"]`, dropping the `kv` table, then `GET /admin/kv/?q=secretvalue` → 500 and no logged argument contains `secretvalue`.
- [ ] Tests: `test/example.test.ts` additionally verifies that `GET /admin/` and every model list (`/admin/users/`, `/admin/posts/`, `/admin/tags/`) return 200.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "List", "Conventions")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (route table, error handling)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (ListPage props, url.ts, format.ts)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (repository list/getMany/options)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Integration coverage": List, Date-only strings, Search on PG, Fallback and errors; row "example")
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md (items 4-7), 016-custom-action-permission.md, 018-pg-search-text-cast.md, 019-date-only-calendar-dates.md, 022-unmatched-routes-and-error-rendering.md, 023-pg-date-string-mode-support.md

## History

- Attempt 1: verify failed (exit 1; PGlite startup timeout in test/errors.test.ts under parallel load)
