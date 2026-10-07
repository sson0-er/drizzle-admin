# 021: Widget overrides are checked against the field kind at registration

- Date: 2026-10-07
- Status: accepted

## Context
`options.widgets` overrides the default widget, but some combinations are undefined (design review, low): `select` without choices, `checkbox` on a string field (coerce yields a boolean that `z.string()` rejects), and `json` on a string field, where it is unclear whether coercion follows the widget or the kind.

## Decision
- Coercion, the zod schema, `toFormValue` and display formatting depend only on the field (`kind`, `isDateOnly`, `foreignKey`), never on the widget. The widget only selects the HTML element.
- `register()` rejects an override that is not in the allowed set for the field: `drizzle-admin: <table>: widget "<w>" is not allowed for field "<key>" (kind <kind>)`.

Changed 2026-10-07: added the row for kind string + `isDateOnly` (PG `date()` string mode), which no longer allows `textarea` / `password`; rows are matched first-match (decision 023).

| Field (first matching row) | Allowed widgets |
|---|---|
| has `foreignKey` | `select`, `number` (number/bigint kind) or `text` (other kinds), `hidden` |
| enum | `select`, `text`, `hidden` |
| boolean | `checkbox` |
| string, `isDateOnly` (decision 023) | `date`, `text`, `hidden` |
| string | `text`, `textarea`, `password`, `hidden` |
| number, bigint | `number`, `text`, `hidden` |
| date, `isDateOnly` | `date`, `text`, `hidden` |
| date, not date-only | `datetime`, `text`, `hidden` |
| json | `json`, `textarea` |
| unknown | none (the field is never editable) |

- `select` on an FK field whose referenced model is not registered (no `slug` after finalization) is rejected at finalization, because there are no choices. If the referenced table has more than 200 rows, a `select` override falls back to the default `tooMany` behaviour (an input plus a link).

## Alternatives considered
- Let the widget drive coercion: `checkbox` on a string field would then need a string meaning for checked and unchecked, and a widget would change data semantics. This is more rules for no requested feature.
- Accept any override and document "undefined": leaves request-time failures, which conflicts with §5.2's intent of failing at registration (unverified reading of §5.2; same reasoning as decision 013 item 13).

## Rationale
This keeps one source of truth (the field) for data handling, and turns every nonsensical override into a configuration error. The forms pipeline itself is internal (no external evidence needed).

## Consequences
- `register.test.ts` covers one rejected and one accepted override per row of the table.
