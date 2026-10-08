---
id: 28-fk-reference-view-permission
depends_on: [27-fk-ordering-and-example]
status: done
attempts: 0
---
# Task 28: fk-reference-view-permission

## Goal
A user without `view` on a referenced model sees no labels of that model. FK list cells show the raw value with no label and no link, the FK filter is not offered and its `f_<key>` parameter is ignored, and FK form fields are plain key inputs with no choices (decision 034). The "too many choices" fallback link appears only for the default and `select` widgets (decision 036 item 1). The misleading FK-filter comment in `src/routes/list.ts` is corrected (decision 033 item 5). Covers L047, L048, L062, L060.

## Scope
### Files to touch
- src/forms/fields.ts
- src/routes/list.ts
- src/routes/form.ts
- test/fields.test.ts
- test/auth.test.ts
### Do not touch
- src/forms/widgets.tsx (a field without `fkFallbackHref` already renders neither the link nor the hint)
- src/auth/** (use the existing `can`)
- src/views/**, src/data/**
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- `src/forms/fields.ts` (forms.md `fields.ts`, default-widget table):
  - The `fkChoices` type becomes `ReadonlyMap<string, Choice[] | "tooMany" | "noView">`.
  - `"noView"` sets the widget to `number` for number/bigint kinds and `text` otherwise, when the widget is the default or a `select` override. A `hidden`, `number` or `text` override is kept. In every case there are no `choices` and no `fkFallbackHref`.
  - `"tooMany"` (L062): `fkFallbackHref` is set only when the widget is the default or a `select` override (the same condition that replaces the widget). `hidden` / `number` / `text` overrides keep their widget and get no `fkFallbackHref`. Today the link is set for every override (line 138).
  - Keep the `?? []` fallback for a missing entry (decision 033 item 6).
- `src/routes/form.ts` `loadFkChoices` (routes-handlers.md Add step 2): for each form FK field with a registered `ref`, when `!can(ref, "view", user)` set `"noView"` and run no `options` query. Otherwise keep the current logic, including the task 27 ordering. Get the user with `requireUser(c)`.
- `src/routes/list.ts` (routes-handlers.md List steps 2, 4, 4b, 5). Let `refVisible = can(ref, "view", user)`:
  - step 2: an `f_<key>` for an FK filter with `!refVisible` is not put into `filters`, so it is not passed to `repo.list`;
  - step 4: `loadFkLabels` runs no `getMany` for a column with `!refVisible`;
  - step 4b: such a cell gets no FK `href` and no `fkLabel`. A `listDisplayLinks` link to the row's own change page still applies (decision 033 item 4);
  - step 5: `filterChoices` returns no section (no `options` query) for an FK filter with `!refVisible`.
  - Compute `refVisible` once per FK key. Do not call `can` per row.
- L060: replace the comment above `const active = ...` in `src/routes/list.ts` ("An unknown value is treated as "all" by the repository...") with one that matches decision 033 item 5. For boolean, enum and date filters `buildFilters` ignores an unknown value, so "all" is accurate. For an FK filter, a valid key outside the offered 200 choices still filters the rows while "all" is shown as selected (accepted).
- Integration test setup (test-strategy.md "FK view permission (decision 034)"): `makeAdmin(fixture, { models: { authors: { permissions: { view: false } }, articles: { listDisplay: ["id", "title", "authorId"], listFilter: ["authorId"] } } })`, logged in. Author names are in `test/helpers/db.ts`. Assert that none of them appears in the HTML.
- CLAUDE.md conventions apply.

## Definition of Done
- [ ] `buildFormGroups` accepts `"noView"` in `fkChoices`, and `src/routes/form.ts` passes it, without an `options` query, when the user lacks `view` on the referenced model.
- [ ] With `!can(ref, "view", user)`, `src/routes/list.ts` runs no `getMany` and no `options` query for that FK and ignores its `f_<key>` parameter.
- [ ] `src/routes/list.ts` no longer contains the sentence `An unknown value is treated as "all" by the repository`.
- [ ] Tests: `test/fields.test.ts`, one it.each row per case:
  - `"noView"` + default widget on a number FK → widget `number`, no `choices`, no `fkFallbackHref`;
  - `"noView"` + `select` override → the same;
  - `"noView"` + `hidden` override → widget `hidden`, no `fkFallbackHref`;
  - `"tooMany"` + `hidden` override → widget `hidden`, no `fkFallbackHref`;
  - `"tooMany"` + `number` override → widget `number`, no `fkFallbackHref`;
  - `"tooMany"` + default and + `select` override → widget `number` with `fkFallbackHref` (keep the existing cases if they already cover these).
- [ ] Tests: `test/auth.test.ts`, new describe "FK view permission (decision 034)", both dialects. With `authors` `view: false`:
  - the `articles` list `td` for `authorId` has the raw id as text and no `a` element;
  - no author name appears anywhere in the list HTML;
  - there is no `div[data-filter=authorId]`;
  - `?f_authorId=1` lists the same rows (same `input[name=_selected]` values) as without it;
  - the articles add page and the change page of article 1 render `input[name=authorId][type=number]` and no `select[name=authorId]`, with no author name and no `a` whose href starts with `/admin/authors/`;
  - a POST to the add page with a valid `authorId` answers 303.
  With `view: true` (default permissions), the same list shows the author label with a link, `div[data-filter=authorId]` exists, and the add page renders `select[name=authorId]`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (section "`fields.ts`" and the default-widget table)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (sections "List" steps 2-5, "Add" step 2, "Change" step 2)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (Integration coverage: "FK view permission (decision 034)"; forms row: FK `tooMany` / `"noView"` cases)
- Decisions: docs/orchestraude/decisions/034-fk-reference-view-permission.md, docs/orchestraude/decisions/036-triage-behavior-changes.md (item 1), docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (items 4, 5, 6)

## History
- Implemented. No new exports or props. `src/routes/list.ts` gets a module-private `hiddenFkKeys` (keys of FK fields whose registered referenced model the user cannot view), computed once per request and consulted for `f_<key>`, `loadFkLabels`, the FK href and the filter section. An FK to an unregistered table behaves as before. The `fkChoices` type in `buildFormGroups` now includes `"noView"`.
- Test note: the default label of `authors` is `authors #<id>`, so the auth tests register `authors` with `toString: name` to make a leak visible in the HTML.
