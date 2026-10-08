# 034: Referenced-model `view` permission gates FK labels, links, filters and selects

- Date: 2026-10-08
- Status: accepted

## Context
Low findings L047 and L048 (security): the list page looks up FK labels (`M.toString` of referenced rows), links FK cells to the referenced change page and offers an FK filter with up to 200 labelled choices, and the add/change forms offer an FK `select` with labelled choices. None of this checks whether the user may `view` the referenced model, so labels of a model the user cannot see are disclosed.

## Decision
User decision (2026-10-08). Let `ref` be the registered model that an FK field references (`foreignKey.slug`). When `!can(ref, "view", U)`:
1. List cells: the FK column shows the raw value formatted as a non-FK value (no `fkLabel`), with no FK link, and no `getMany` label query is run for that column. A `listDisplayLinks` link to the row's own change page is unaffected (decision 033 item 4). A formatter on the column is unaffected (it already bypasses FK labels).
2. List FK filter: not offered (no sidebar section, no `options` query), and an `f_<key>` query parameter for it is ignored (not passed to `repo.list`).
3. Add/change forms: the FK field gets no choices (no `options` query). Its widget falls back to the plain primary-key input like the "too many choices" case: `number` for number/bigint kinds, otherwise `text`, when the widget is the default or a `select` override; other overrides (`hidden`, `number`, `text`) stay. Unlike the "too many" case, there is no `fkFallbackHref` link and no `fkTooMany` hint, because the user cannot open the referenced list. Mechanism: the route passes the marker `"noView"` in `fkChoices` for that field.
4. Display-only FK fields (change page) already render the stored value through `DisplayValue` without a label lookup; unchanged.

## Alternatives considered
- Accept the Django-like behavior and record it in review-policy.md: rejected by the user; it discloses labels of models the user is not allowed to view.
- Hide the FK field entirely on add/change forms: a required FK could then never be filled in, so the add form would always fail.
- Keep applying a manual `f_<key>` parameter while hiding the filter: the active filter would be invisible and could not be cleared from the sidebar; ignoring it keeps "no filter offered" consistent. Applying it would disclose nothing new (the raw values are already visible), so this is a UI-consistency choice, not a security one.
- Keep the fallback link to the referenced list: it leads to a 403 page.

## Rationale
User decision after the low-findings triage. The permission helper `can()` (auth.md) already exists; the check costs nothing and saves queries. Raw FK values are not considered sensitive: they are column values of the model the user is viewing.

## Consequences
- routes-handlers.md List steps 4, 4b, 5 and Add step 2; forms.md `fkChoices` type gains `"noView"` and the widget table gains a row.
- test-strategy.md: permission matrix cases for a user without `view` on `authors` viewing `articles` (raw `authorId`, no link, no filter, `f_authorId` ignored, plain input on add/change, no author names anywhere in the HTML).
- Follow-up code change in `src/routes/list.ts`, `src/routes/form.ts` and `src/forms/fields.ts`.
