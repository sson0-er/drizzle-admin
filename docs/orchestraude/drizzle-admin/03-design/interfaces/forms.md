# Interface: forms

Files: `src/forms/fields.ts` (layout and widget choice), `src/forms/coerce.ts`, `src/forms/schema.ts` (zod), `src/forms/validate.ts` (pipeline steps 1-4), `src/forms/widgets.tsx` (input rendering).
Inputs: `ResolvedModel` ([admin.md](admin.md)), `FieldMeta` ([introspect.md](introspect.md)), time helpers and messages ([support.md](support.md)).

## Responsibilities
- Decide which fields appear on add/change forms, which are editable, and which widget each uses.
- Turn submitted strings into typed values (§9 coercion), validate with a generated zod schema and the user's `validate`.
- Render each widget and convert stored values to form strings.
- Never write to the DB (routes do steps 5-6 of §9).

## API

### `fields.ts`
```ts
export type FormMode = "add" | "change";
export type Choice = { value: string; label: string };
export interface FormField {
  key: string; label: string;            // label = key (no verbose names in v1)
  meta: FieldMeta;
  widget: WidgetType;
  editable: boolean;                     // false → rendered display-only, never read from the body
  required: boolean;                     // notNull && !(mode === "add" && hasDefault); for the UI marker only
  choices?: Choice[];                    // select widgets (enum, FK); includes { value: "", label: "---------" } when !notNull
  fkFallbackHref?: string;               // FK with > 200 choices: link to the referenced list page
}
export interface FormGroup { title?: string; fields: FormField[] }
export function buildFormGroups(args: {
  model: ResolvedModel; mode: FormMode; canChange: boolean; prefix: string;
  fkChoices: ReadonlyMap<string, Choice[] | "tooMany">;   // keyed by field key, only FK fields with slug
  refSlugOf: (key: string) => string | undefined;
}): FormGroup[];
export function editableFields(groups: FormGroup[]): FormField[];
```
Changed 2026-10-07: `allowedWidgets` added (decision 021).
Changed 2026-10-07: row for date-only strings (PG `date()` string mode) added (decision 023).

```ts
export function allowedWidgets(meta: FieldMeta): readonly WidgetType[]; // used by register() (admin.md step 5)
```
| Field (first matching row) | Allowed widgets |
|---|---|
| has `foreignKey` | `select`, `hidden`, plus `number` for number/bigint kind or `text` otherwise |
| kind enum | `select`, `text`, `hidden` |
| kind boolean | `checkbox` |
| kind string and `isDateOnly` | `date`, `text`, `hidden` |
| kind string | `text`, `textarea`, `password`, `hidden` |
| kind number / bigint | `number`, `text`, `hidden` |
| kind date and `isDateOnly` | `date`, `text`, `hidden` |
| kind date | `datetime`, `text`, `hidden` |
| kind json | `json`, `textarea` |
| kind unknown | none |

Inclusion and editability (iterate `model.fieldsets`, empty groups dropped):
| Field | add mode | change mode |
|---|---|---|
| auto-increment PK | omitted | display-only |
| other PK | editable | display-only (decision 013 item 2) |
| in `readonlyFields`, `isGenerated`, or kind `unknown` | omitted | display-only |
| other | editable | editable if `canChange`, else display-only |

Changed 2026-10-07: overrides are restricted per field kind, and data handling never depends on the widget (decision 021).
Changed 2026-10-07: the `date` default covers date-only strings too (decision 023).

Default widget (an explicit `model.widgets[key]` wins; `register()` has already checked it against the allowed set in decision 021, see admin.md step 5). The widget only chooses the HTML element. Coercion, the zod schema, `toFormValue` and display depend on `meta` (`kind`, `isDateOnly`, `foreignKey`) only. A `select` override on an FK field uses `fkChoices`. When the choices are `"tooMany"`, the field falls back to the `tooMany` row below.
| Condition (in order) | Widget |
|---|---|
| `foreignKey.slug` set and choices not `"tooMany"` | `select` (choices from `fkChoices`) |
| `foreignKey.slug` set and `"tooMany"` | `number` for number/bigint kinds, otherwise `text`, plus `fkFallbackHref = <prefix>/<refSlug>/` |
| kind enum | `select` (choices = enumValues, label = value) |
| kind boolean | `checkbox` |
| `isDateOnly` (kind date or string) | `date` |
| kind date | `datetime` |
| kind json | `json` |
| kind number / bigint | `number` |
| kind string and `isLongText` | `textarea` |
| otherwise | `text` |

### `coerce.ts`
Changed 2026-10-07: rule 1 keys on kind only (decision 021); date-only parsing uses UTC calendar dates (decision 019).
Changed 2026-10-07: date-only strings (kind string + `isDateOnly`) are validated as `YYYY-MM-DD` and kept as strings (decision 023).

```ts
export type FormBody = Record<string, string | File | (string | File)[]>; // from c.req.parseBody({ all: true })
export function coerceForm(fields: FormField[], body: FormBody, mode: FormMode, timeZone: string):
  { data: Record<string, unknown>; errors: Record<string, string> };
export function rawValues(fields: FormField[], body: FormBody): Record<string, string>; // for re-render
```
Only `fields` (the editable ones) are read; all other body keys are ignored (mass-assignment protection). For multi-valued keys the last string is used, and `File` values count as missing. Strings are not trimmed, except for number/bigint/date parsing and date-only strings.

Per field, with `raw = body[key]`:
1. Kind boolean: present and not `"0"`/`"false"` → `true`; missing, `"0"` or `"false"` → `false`. Never "empty".
2. `raw` missing or `""`:
   - `!notNull` → `null`
   - `notNull && hasDefault && mode === "add"` → key omitted from `data`
   - otherwise error `messages.required`
3. Otherwise by kind (FK fields use their own kind):
   - number: `Number(raw.trim())` must be finite, else `invalidNumber`; `isInteger` and not an integer → `invalidInteger`.
   - bigint: `/^-?\d+$/` → `BigInt`, else `invalidInteger`.
   - date: `meta.isDateOnly` → `parseDateOnly(raw.trim())` (UTC midnight, no time zone; decision 019); otherwise `parseDatetimeLocal(raw.trim(), timeZone)`; `null` → `invalidDate`. The time zone must not be applied to date-only values: drizzle stores `toISOString()`'s date part, so a Tokyo midnight would be saved as the previous day (evidence: 2026-10-07-drizzle-pg-date-mapping).
   - json: `JSON.parse`, else `invalidJson`.
   - enum: must be in `enumValues`, else `invalidChoice`.
   - string: `meta.isDateOnly` → `v = raw.trim()`; `parseDateOnly(v) === null` → `invalidDate`; otherwise the value is `v` itself, a `YYYY-MM-DD` string (the parsed Date is only a validity check and is discarded; no time zone; decision 023). This check is required: PG rejects impossible dates such as `2026-02-30` only as a generic DB error (SQLSTATE 22008) and silently accepts other formats such as `2026/10/07` (evidence: 2026-10-07-pg-date-string-mode-filtering). Otherwise as-is.

### `schema.ts`
```ts
export function buildZodSchema(fields: FormField[], mode: FormMode): z.ZodObject<z.ZodRawShape>;
```
Per editable field: base string → `z.string()` (date-only strings included; coercion has already checked the format); number → `z.number()` (`.int()` when `isInteger`); bigint → `z.bigint()`; boolean → `z.boolean()`; date → `z.date()`; json → `z.unknown()`; enum → `z.enum(enumValues)`. Then `.nullable()` if `!notNull`, and `.optional()` if `mode === "add" && notNull && hasDefault`. `safeParse` issues map to `{ [path[0]]: messages.invalidValue }`, first issue per field. zod's own messages are never shown.

### `validate.ts` (§9 steps 1-4)
```ts
export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; fieldErrors: Record<string, string>; formErrors: string[]; values: Record<string, string> };
export async function validateSubmission(args: {
  model: ResolvedModel; fields: FormField[]; body: FormBody; mode: FormMode; timeZone: string;
}): Promise<ValidationResult>;
```
Order: coerce → if errors, stop → zod → if errors, stop → `model.validate?.(data, { mode })`. Returned keys that are editable field keys become field errors; any other key becomes a form error with the message text. Errors from earlier steps are returned without running later steps. A `validate` that throws is not caught (it is a programming error → 500).

### `widgets.tsx`
```ts
export function Widget(props: { field: FormField; value: string; error?: string }): JSX.Element;
export function DisplayValue(props: { field: FormField; value: unknown; timeZone: string }): JSX.Element;
export function toFormValue(field: FormField, value: unknown, timeZone: string): string;
```
Changed 2026-10-07: `toFormValue` selects by `meta`, not by widget (decisions 019, 021).
Changed 2026-10-07: date-only strings pass through unchanged (decision 023).

`toFormValue` (by `meta.kind`): null/undefined → `""`; date → `toDateOnly(v)` when `meta.isDateOnly` (UTC parts), else `toDatetimeLocal(v, timeZone)`; boolean → `"on"` / `""`; json → `JSON.stringify(v, null, 2)`; bigint/number → `String`; string → itself (for a date-only string this is the stored `YYYY-MM-DD`, which `<input type="date">` accepts as its value; decision 023).

Rendering (`name` and `id` = `id_<key>`):
| Widget | Element |
|---|---|
| text | `<input type="text">` |
| password | `<input type="password" value=...>` (decision 013 item 11) |
| number | `<input type="number" step="1" or "any">` (`step="1"` when `isInteger` or bigint) |
| textarea, json | `<textarea>` (json gets `class="json"`) |
| checkbox | `<input type="checkbox" checked={value === "on"}>` |
| select | `<select>` with `choices`; the selected option matches `value` |
| date | `<input type="date">` |
| datetime | `<input type="datetime-local">` |
| hidden | `<input type="hidden">` (no label row) |
`required` attributes are not emitted, so the server-side errors stay observable and testable with plain requests. An error renders `<ul class="errorlist"><li>msg</li></ul>` before the input. `fkFallbackHref` renders `<a href>` with `messages.openRelated` and the `fkTooMany` hint. `DisplayValue` renders the formatted value as text (views `formatValue`).

## Data formats
- Field names in HTML equal `FieldMeta.key`. Reserved body names: `_csrf`, `_save`, `_addanother`, `_continue`.

## Errors
- No exceptions for user input; all problems are returned as messages from `support/messages`.
