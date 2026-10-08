# 035: Human field labels from the humanized field key

- Date: 2026-10-08
- Status: accepted (choice confirmed by the user, 2026-10-08)

## Context
Low finding L067: list column headers and filter headings show raw field keys such as `authorId`. The user approved that `ListPage` `columns` and `filters` carry a human `label` filled in by the route from field metadata, and asked the designer to choose a sensible label source. The design has no verbose-name mechanism: forms.md sets `FormField.label = key` ("no verbose names in v1").

## Decision
Add one label function, used everywhere a field is named in the UI:
```ts
// src/forms/fields.ts
export function fieldLabel(key: string): string;
```
Algorithm, in order: (1) insert a space between a lowercase ASCII letter or digit and a following uppercase ASCII letter (`authorId` → `author Id`); (2) replace `_` and `-` with a space; (3) collapse runs of spaces and trim; (4) lowercase everything, then uppercase the first character; (5) if the result is empty, return `key` unchanged.
Examples: `authorId` → `Author id`, `created_at` → `Created at`, `isActive` → `Is active`, `id` → `Id`, `big` → `Big`, `_` → `_`.

Used by:
- `ListPage` `columns[].label` and `filters[].label` (routes fill them with `fieldLabel(key)`); headers and filter headings show the label, while `data-key` / `data-filter` keep the key.
- `FormField.label` (forms.md) changes from `key` to `fieldLabel(key)`, so the list and the forms name a field the same way.

Changed 2026-10-08: the user confirmed this choice as is: the humanized key for list headers, filter headings and form labels, and no new `labels` option.

## Alternatives considered
- Keep `label = key` (the existing form mechanism): does not fix L067.
- Use the DB column name (`meta.fields[].name`, e.g. `author_id`): still a raw identifier, and it differs from the key users write in options.
- Add a public `labels` / verbose-name option to `ModelAdminOptions`: a public API addition the requirements do not ask for; it can be added later compatibly, with `fieldLabel` as its default.
- Apply the humanized label only to the list and keep keys on forms: two naming schemes for the same field on adjacent pages.

## Rationale
Django derives a field's default verbose name from the field name with underscores replaced by spaces and shows it with the first letter capitalized (unverified against current Django docs; the behavior is well known). Drizzle keys are usually camelCase, so camelCase splitting is added. The function is pure and needs no new configuration. Labels are escaped by Hono JSX like any text.

## Consequences
- forms.md (`fieldLabel`, `FormField.label`), views.md (`ListPage` props), routes-handlers.md (List step 7).
- Changing `FormField.label` alters the visible form labels (e.g. `authorId` → `Author id`); tests that match label text update accordingly. The `div.form-row[data-field=<key>]` selector is unchanged.
- Follow-up code change in `src/forms/fields.ts`, `src/routes/list.ts`, `src/views/list.tsx`.
