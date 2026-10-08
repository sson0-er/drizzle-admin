# 035: Field labels stay the raw field key in v1

- Date: 2026-10-08
- Status: accepted. Changed by the user on 2026-10-08: the first version (humanized labels such as `authorId` → "Author id") was superseded before any code was written.

## Context
Low finding L067: list column headers and filter headings show raw field keys such as `authorId`. The triage asked whether `ListPage` `columns` and `filters` should carry a human `label` filled by the route from field metadata. The design has no verbose-name mechanism: forms.md sets `FormField.label = key` ("no verbose names in v1").

First version (2026-10-08, superseded): add `fieldLabel(key)` to `src/forms/fields.ts`, which humanizes the key (split camelCase, `_` and `-` into words, lowercase, capitalize the first letter). Use it for list column headers, filter headings and `FormField.label`.

## Decision
User decision (2026-10-08, changed after first approving the humanized version). List column headers, filter headings and form labels keep showing the raw field key (e.g. `authorId`), as the current code does. `ListPage` `columns` and `filters` get no `label` prop, `FormField.label` stays `key`, and v1 has no `labels` option. L067 is closed as accepted behavior.

## Alternatives considered
- Humanized key (`fieldLabel`, the first version): rejected by the user. Auto-generated English labels such as "Author id" clash with the Japanese UI and add little in a developer-facing admin.
- Public `labels` / verbose-name option on `ModelAdminOptions`: the requirements do not ask for it in v1. It can be added later without breaking anything, and the raw key stays the default.
- DB column name (`author_id`): still a raw identifier, and it differs from the keys used in options.

## Rationale
User decision. The admin's users are developers and operators who know the schema keys. A raw key is unambiguous and matches the `ModelAdminOptions` keys. A half-translated label would not.

## Consequences
- No interface change: views.md `ListPage` props and routes-handlers.md List step 7 stay as before, forms.md keeps `label = key`, and test-strategy.md has no label cases.
- No follow-up code change for L067.
- A later `labels` option is a possible extension, not planned.
