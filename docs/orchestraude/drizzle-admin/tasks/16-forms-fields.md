---
id: 16-forms-fields
depends_on: [05-register-and-finalize]
status: done
attempts: 0
---
# Task 16: forms-fields

## Goal
Add/change form layout is computed from a `ResolvedModel`: which fields appear, which are editable, which widget each uses, and the select choices, including the FK fallback to a PK input with a link when there are more than 200 choices.

## Scope
### Files to touch
- src/forms/fields.ts (add `FormMode`, `Choice`, `FormField`, `FormGroup`, `buildFormGroups`, `editableFields`; keep `allowedWidgets` from task 05)
- test/fields.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/admin.ts, src/types.ts, src/introspect/**
- `allowedWidgets` behavior (task 05) except bug fixes recorded in History

## Implementation notes
- API, inclusion/editability table and default-widget table: `interfaces/forms.md#fieldsts`. Iterate `model.fieldsets`; drop empty groups. `label = key`.
- `required = notNull && !(mode === "add" && hasDefault)` (UI marker only).
- An explicit `model.widgets[key]` wins over the default (it was already checked by `register()`). The widget only chooses the HTML element.
- FK fields with a slug: `fkChoices.get(key)` is `Choice[]` → `select` with those choices; `"tooMany"` → `number` for number/bigint kinds, otherwise `text`, plus `fkFallbackHref = <prefix>/<refSlug>/`. A `select` override on an FK with `"tooMany"` also falls back.
- Enum selects: choices = `enumValues` (label = value). Select choices include `{ value: "", label: "---------" }` first when `!notNull`.
- The choices are computed by routes (task 19); this function only consumes `fkChoices`.

## Definition of Done
- [ ] Tests: `test/fields.test.ts` verifies the editability table for both modes: auto-increment PK omitted on add and display-only on change; a non-auto PK (`kv.key`) editable on add and display-only on change; `readonlyFields`, `isGenerated` and kind `unknown` omitted on add and display-only on change; other fields display-only on change when `canChange` is false.
- [ ] Tests: `test/fields.test.ts` verifies each default-widget row (FK select, FK `tooMany` → `number` + `fkFallbackHref` `/admin/authors/`, enum select, checkbox, date-only Date and date-only string → `date`, timestamp → `datetime`, json, number, PG `text` → `textarea`, `varchar` → `text`), that a widget override replaces the default, and that the empty choice is present only for nullable selects.
- [ ] Tests: `test/fields.test.ts` verifies `fieldsets` grouping with titles, empty groups dropped, `exclude` applied, and `editableFields` returns only editable fields in order.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md#fieldsts
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (ResolvedModel)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "forms")
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md (items 1, 2), 021-widget-override-compatibility.md, 023-pg-date-string-mode-support.md

## History
