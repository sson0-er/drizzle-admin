---
id: 27-fk-ordering-and-example
depends_on: [06-example-app, 15-routes-list, 19-routes-add-change]
status: pending
attempts: 0
---
# Task 27: fk-ordering-and-example

## Goal
FK filter choices on the list page and FK select choices on add/change forms come in the referenced model's default ordering (decision 013 items 4 and 7): its `ordering` when set, otherwise primary key descending, the same fallback the list page already uses. The example seed computes its "earlier this month" clamp from the `now` of each `seed()` call, and the example server listens on `127.0.0.1` unless `HOST` is set (decision 038). Covers low findings L083, L002, L090, L119.

## Scope
### Files to touch
- src/routes/list.ts
- src/routes/form.ts
- src/routes/context.ts (only if you extract the shared ordering helper, see notes)
- test/list.test.ts
- test/form.test.ts
- example/seed.ts
- example/server.ts
- test/example.test.ts
### Do not touch
- README.md and test/readme.test.ts (the README text for `HOST` / `127.0.0.1` is task 36)
- src/data/** (the repository already sorts by whatever `ordering` it is given)
- example/app.ts, example/schema.ts
- docs/** (except this task's History), CLAUDE.md, mise.toml, package.json, pnpm-lock.yaml
- Do not commit.

## Implementation notes
- FK ordering (L083). Today `filterChoices` in `src/routes/list.ts` and `loadFkChoices` in `src/routes/form.ts` pass `ref.ordering` to `repo.options`. That is `[]` when the referenced model has no `ordering`, so `buildOrderBy` falls back to primary key ascending. Decision 013 item 7 says "the referenced model's default ordering", and item 4 defines that default as primary key descending. Pass `ref.ordering.length > 0 ? ref.ordering : [{ key: ref.meta.pk.key, desc: true }]`, the same expression `listHandler` uses for the page ordering (list.ts lines 116-121, without the user `o` part).
  - Three copies of this fallback are within the CLAUDE.md duplication convention. You may instead extract one helper (for example `defaultOrdering(model: ResolvedModel)`) into `src/routes/context.ts` and use it in all three places. If you do, record the new export in History, as the CLAUDE.md conventions require.
  - Note: routes-handlers.md List step 5 literally writes `ordering: refModel.ordering`. Follow decision 013 item 7 (user-approved for this task). The orchestrator updates the design text.
- Seed clamp (L002, L090). `PUBLISH_AGES_DAYS` in `example/seed.ts` calls `new Date().getDate()` at module load. Compute the clamp inside `seed()` from its own `now`: `Math.min(12, new Date(now).getDate() - 1)`. Keep the other ages (0, 2, 5, 40, 75) and the order. Do not change the signature `seed(db)` (example.md).
- Example bind (decision 038). In `example/server.ts`, `hostname = process.env.HOST ?? "127.0.0.1"` is passed to `serve({ fetch, port, hostname })`. The printed URL is built from `hostname` and `port`, with an IPv6 literal in brackets (for example `http://[::1]:3000/admin/`). Keep the existing password and secret warnings. `server.ts` opens a port, so it is not unit-tested. Report in History whether you ran `pnpm example` and saw the printed URL (mark it "未確認" if you did not).
- Seed distribution test (L119). In `test/example.test.ts`, build an in-memory SQLite database with `createSchema` + `drizzle` and call `seed(db)` with the system time faked through `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(...)`. Use local-time constructors such as `new Date(2026, 10, 1, 12)` so the day of month does not depend on the process time zone. Restore real timers afterwards. Compute each published post's age as `(now - publishedAt) / DAY_MS`. The module is imported before the fake time is set, so a module-load clamp fails this test unless the real date happens to give the same clamp.
- CLAUDE.md conventions apply (it.each tables, exact assertions, no single-use aliases).

## Definition of Done
- [ ] `src/routes/list.ts` (FK filter choices) and `src/routes/form.ts` (FK select choices) pass the primary-key-descending ordering to `repo.options` when the referenced model has no `ordering`, and the model's `ordering` otherwise.
- [ ] `example/seed.ts` has no `new Date()` / `Date.now()` call outside `seed()`.
- [ ] `example/server.ts` passes `hostname` (`process.env.HOST ?? "127.0.0.1"`) to `serve`, and the printed URL uses that host.
- [ ] Tests: `test/list.test.ts`, both dialects. On the `articles` list with `listFilter: ["authorId"]` and `authors` registered without `ordering`, the choice links of `div[data-filter=authorId]` after "all" carry `f_authorId` = 4, 3, 2, 1 in that order. With `authors` registered with `ordering: ["id"]` the order is 1, 2, 3, 4.
- [ ] Tests: `test/form.test.ts`, both dialects. The `articles` add page `select[name=authorId]` option values are `["4", "3", "2", "1"]` with `authors` unordered, and `["1", "2", "3", "4"]` with `ordering: ["id"]`. Existing tests that assumed ascending order are updated, and each update is listed in History.
- [ ] Tests: `test/example.test.ts`. With the system time faked to the 1st and to the 5th of a month at local noon, the set of distinct publish ages (whole days) of the seeded published posts is `{0, 2, 5, 40, 75}` on the 1st (the clamp is 0, the same as "today") and `{0, 2, 4, 5, 40, 75}` on the 5th. Use an it.each table with one row per date.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "List" steps 2 and 5, "Add" step 2)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md (items 4, 7), docs/orchestraude/decisions/038-body-size-and-example-bind.md
- Findings: docs/orchestraude/drizzle-admin/05-low-findings-triage.md (L083, L002, L090, L119)
- Evidence: docs/orchestraude/evidence/2026-10-08-hono-head-cookie-body-node-server.md (`serve` passes `hostname` to `listen`)

## History
