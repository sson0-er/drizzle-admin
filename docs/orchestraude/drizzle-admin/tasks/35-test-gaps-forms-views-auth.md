---
id: 35-test-gaps-forms-views-auth
depends_on: [30-cookie-deletion-and-head-guard, 32-password-no-echo]
status: done
attempts: 0
---
# Task 35: test-gaps-forms-views-auth

## Goal
The forms, views, auth, introspection and public-API paths named in the low-findings triage have tests that can fail:
- FK widget edge cases and `refSlugOf` use (L121, L128, L136);
- coercion edge cases (L137);
- `DisplayValue` for date-only and json values (L106);
- the flash tamper guard and the deletion of invalid flash cookies (L108, L111);
- the layout without flash (L116);
- the runtime exports of `src/index.ts` (L118);
- precise config error matching (L034, L129);
- the introspection rules for multi-column FKs, generated columns and unknown kinds (L117);
- JSON truncation in list cells (L135, decision 033 item 15).

Test-only task.

## Scope
### Files to touch
- test/fields.test.ts
- test/coerce.test.ts
- test/widgets.test.ts
- test/flash.test.ts
- test/views.test.ts
- test/types.test.ts
- test/config.test.ts
- test/introspect.sqlite.test.ts
- test/format.test.ts
### Do not touch
- src/** (if a new test fails against the current code, stop, report the case and the observed result in History, and leave the code unchanged)
- test/helpers/**, test/fixtures/**, test/__snapshots__/** (use inline tables for new introspection cases; existing snapshots must not change)
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- Before adding a case, check whether tasks 28, 31 and 32 already added an equivalent one to the same file (CLAUDE.md: no assertions that another test already implies). List skipped items in History.
- `fields.test.ts`:
  - L121: in "replaces the default widget with an explicit override", replace `active: "checkbox"` (equal to the default) with an override that differs from the default (for example `name: "textarea"` or `role: "text"`) and assert the resulting widget.
  - L128: in one `tooMany` test, pass a `refSlugOf` that returns a slug different from `meta.foreignKey.slug` (for example `"people"`), and assert `fkFallbackHref === "/admin/people/"`.
  - L136, one it.each row each:
    - a bigint FK with `"tooMany"` and the default widget → widget `number` with `fkFallbackHref`;
    - an FK with a choices list and a `number` / `text` override → the override is kept and there are no `choices`;
    - an FK with `foreignKey.slug` and no `fkChoices` entry → widget `select` with an empty choice list, or only the empty choice when nullable (decision 033 item 6).
- `coerce.test.ts` (L137): bigint `" 5 "` → `5n`. Date-only Date kind (PG `date({mode:"date"})` meta) `"2026/10/07"` → `messages.invalidDate`.
- `widgets.test.ts` (L106): `DisplayValue`, it.each over `Asia/Tokyo` and `America/New_York`:
  - a date-only Date `2026-10-07T00:00:00Z` shows `2026/10/07`;
  - a json value `{ a: 1 }` shows `{"a":1}`.
- `flash.test.ts`:
  - L108: in the tampered-cookie test, assert the tampered value differs from the original before using it, as the session test does.
  - L111: for every invalid-cookie case, assert that the response has a `da_flash` Set-Cookie with `Max-Age=0`.
- `views.test.ts` (L116): the layout rendered with `flash: []` contains no `ul.messagelist`.
- `types.test.ts` (L118): `Object.keys(await import("../src/index.js"))` equals `["createAdmin"]`.
- `config.test.ts` (L034, L129): the `rejects` helper builds `new RegExp(\`^drizzle-admin: .*${escaped}\`)`, where `escaped` is the option name with regex metacharacters escaped. Drop the dead `^Error: ` alternative.
- `introspect.sqlite.test.ts` (L117), inline `sqliteTable`s, one it.each row each:
  - a table with a two-column `foreignKey({ columns: [a, b], foreignColumns: [...] })` → neither field has `foreignKey`;
  - a column with `.generatedAlwaysAs(...)` → `isGenerated: true`;
  - a `blob({ mode: "buffer" })` column → kind `unknown`.
  Use `introspectTable(..., "sqlite")` and assert the fields directly, not via snapshots.
- `format.test.ts` (L135): a json value whose `JSON.stringify` is longer than 100 characters → `formatCell` / `formatValue` returns its first 100 characters + `…`.
- CLAUDE.md conventions apply.

## Definition of Done
- [ ] Tests: `test/fields.test.ts`. The override test asserts a widget different from the default. One test proves `refSlugOf` is used (a distinct slug in `fkFallbackHref`). There are rows for bigint FK + `tooMany`, an FK with a list + a non-select override, and a missing `fkChoices` entry.
- [ ] Tests: `test/coerce.test.ts`. `" 5 "` on a bigint field gives `5n`. `"2026/10/07"` on a date-only Date field gives `invalidDate`.
- [ ] Tests: `test/widgets.test.ts`. `DisplayValue` date-only and json cases, for both zones.
- [ ] Tests: `test/flash.test.ts`. The tamper guard assertion is present. Every invalid-cookie case asserts the `Max-Age=0` deletion.
- [ ] Tests: `test/views.test.ts`. The layout with no flash has no `ul.messagelist`.
- [ ] Tests: `test/types.test.ts`. The runtime export keys equal `["createAdmin"]`.
- [ ] Tests: `test/config.test.ts`. The helper regex is anchored at `^drizzle-admin: ` with the option name escaped. Every existing `rejects` call still passes.
- [ ] Tests: `test/introspect.sqlite.test.ts`. Multi-column FK ignored, `isGenerated` true, `blob` buffer → `unknown`. The existing snapshot file is unchanged.
- [ ] Tests: `test/format.test.ts`. A JSON value longer than 100 characters is truncated to 100 characters + `…`.
- [ ] No file under `src/` is changed.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (sections "`fields.ts`", "`coerce.ts`", "`widgets.tsx`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (sections "`format.ts`", "Layout and common props")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (section "`flash.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/introspect.md (section "Mapping rules")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (section "Exports of `src/index.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (views row: JSON truncation L135)
- Decisions: docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (items 6, 15)
- Findings: docs/orchestraude/drizzle-admin/05-low-findings.md (L034, L106, L108, L111, L116-L118, L121, L128, L129, L135-L137 details)

## History

- Implemented as test-only; no new test failed against the current code. Skipped: none of the listed items was already covered by tasks 28, 31 or 32.
- fields.test.ts: the "text override on an FK with a choices list" row sets `widgets` on the resolved model, because `register` rejects `text` on a numeric FK. The three copy-pasted meta-patching blocks became one `withMeta` helper (fourth copy), and `articlesAndAuthors` moved to module level.
- L121: `active: "checkbox"` was removed from the override test; `name: "textarea"` and `role: "text"` already differ from the defaults.
