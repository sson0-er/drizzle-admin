---
id: 18-forms-widgets-and-form-page
depends_on: [16-forms-fields, 11-views-layout-and-list-pages]
status: done
attempts: 0
---
# Task 18: forms-widgets-and-form-page

## Goal
Each widget renders the correct input element, stored values are converted to form strings by field meta (not by widget), display-only fields render as formatted text, and `FormPage` renders the add/change form with errors, save buttons and the delete link.

## Scope
### Files to touch
- src/forms/widgets.tsx
- src/views/form.tsx
- test/widgets.test.ts (new; widget rendering, `toFormValue`, `DisplayValue`, `FormPage`)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/forms/fields.ts, src/forms/coerce.ts, src/forms/schema.ts, src/forms/validate.ts
- src/views/layout.tsx, src/views/format.ts (bug fixes only, recorded in History)
- src/routes/**

## Implementation notes
- `Widget`, `DisplayValue`, `toFormValue` and the rendering table: `interfaces/forms.md#widgetstsx`. `name` = key, `id` = `id_<key>`. No `required` attributes. An error renders `<ul class="errorlist"><li>msg</li></ul>` before the input. `fkFallbackHref` renders `<a href>` with `messages.openRelated` and the `messages.fkTooMany` hint. `hidden` has no label row.
- `toFormValue` selects by `meta.kind` (decisions 019, 021, 023): date-only Date → `toDateOnly` (UTC parts), timestamp → `toDatetimeLocal(v, tz)`, boolean → `"on"`/`""`, json → `JSON.stringify(v, null, 2)`, number/bigint → `String`, string → itself, null/undefined → `""`.
- `DisplayValue` uses `formatValue` (task 10) as text.
- `FormPage` props and selectors: `interfaces/views.md` "Pages" row `FormPage` (`form#model-form` POST, `fieldset.module` per group with `h2` title, `div.form-row[data-field=<key>]`, `p.errornote` when any error, `ul.errorlist`, buttons `_save` / `_addanother` / `_continue` only when `canSave`, `a.deletelink` when `deleteHref`). Display-only fields render through `DisplayValue` from `displayRow`. Hidden `_csrf` input via the chrome token.

## Definition of Done
- [ ] Tests: `test/widgets.test.ts` verifies each widget's element: text, password (value kept), number with `step="1"` for integer/bigint and `step="any"` otherwise, textarea, json (`textarea.json`), checkbox `checked` only for `"on"`, select with the matching option selected, `input[type=date]`, `input[type=datetime-local]`, hidden; all with `name=<key>`, `id=id_<key>`, and no `required` attribute; an error renders `ul.errorlist li` before the input; `fkFallbackHref` renders the link text `messages.openRelated`.
- [ ] Tests: `test/widgets.test.ts` verifies `toFormValue`: date-only UTC midnight → `"2026-10-07"` regardless of time zone; date-only string `"2026-10-07"` → `"2026-10-07"`; timestamp → `datetime-local` in the zone; boolean; json pretty-printed; bigint; null → `""`; and a `text` override on a date field still converts by meta.
- [ ] Tests: `test/widgets.test.ts` renders `FormPage` and verifies `form#model-form`, `fieldset.module h2`, `div.form-row[data-field]`, `p.errornote` present only with errors, the three buttons present only when `canSave`, `a.deletelink` only with `deleteHref`, and a `_csrf` hidden input.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md#widgetstsx
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (sections "Layout and common props", "Pages", "format.ts")
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "forms")
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md (item 11), 019-date-only-calendar-dates.md, 021-widget-override-compatibility.md, 023-pg-date-string-mode-support.md

## History
- Implemented. `FormPage` takes an extra required `timeZone` prop (not in the views.md table) because display-only date-times need a zone; `values` holds form strings and `displayRow` the stored row. A widget "hidden" field renders its input without a `div.form-row`.
