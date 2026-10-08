---
id: 2026-10-08-formpage-timezone-prop
question: Which props does the task 18 FormPage take, and why does it need a time zone?
source: src/views/form.tsx, src/forms/widgets.tsx (working tree 2026-10-08, task 18)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `FormPageProps` = `mode`, `modelLabel`, `groups: FormGroup[]`, `values: Record<string, string>`, `fieldErrors: Record<string, string>`, `formErrors: string[]`, `canSave: boolean`, `deleteHref?: string`, `displayRow?: Record<string, unknown>`, and a required `timeZone: string`.
- Editable fields render `Widget` with `values[key] ?? ""` (form strings); display-only fields render `DisplayValue({ field, value: displayRow?.[key], timeZone })`.
- `DisplayValue` is `formatValue(field.meta, value, timeZone)` in a `span.readonly`, so date-time display needs the zone.
- An editable field with widget `hidden` renders only the input, without `div.form-row`.

Not confirmed:
- The add/change handlers (src/routes/form.ts) do not exist yet, so how the route passes `timeZone` is not observed in code.
