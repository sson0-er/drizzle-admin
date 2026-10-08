# 037: The password widget never echoes a value; empty on change keeps the stored value

- Date: 2026-10-08
- Status: accepted (amends decision 013 item 11 and decision 021)

## Context
Decision 013 item 11 made the `password` widget an `<input type="password">` that renders the current value like any text input. That puts the stored value (often a password hash or secret) into the page HTML. The triage listed it as a follow-up outside the B items, and the user approved changing it.

## Decision
User decision (2026-10-08).
1. `Widget` for `password` always renders `<input type="password">` with an empty value: no `value` attribute (or `value=""`), regardless of the `value` prop. This covers the change page GET and every 400 re-render (add and change), so neither the stored nor the submitted password appears in the HTML.
2. Change mode: for an editable field whose widget is `password`, a missing or `""` submission omits the key from `data`, so `repo.update` keeps the stored value. A non-empty submission is coerced as usual (kind string, as-is). The zod schema makes such a field `.optional()` in change mode, and its `required` UI marker is false in change mode.
3. Add mode is unchanged: an empty password follows coercion rule 2 (null, omitted when it has a default, or `required`).
4. A display-only field whose widget is `password` (for example on a view-only change page) renders the fixed mask `********` instead of `DisplayValue`, so the stored value is not in the HTML either. The mask is a glyph-only literal (decision 033 item 11).
5. Changed 2026-10-08 (user answer to Q7, option (b)): list cells of a field whose widget is `password` also render `********`. Together with point 4 this covers every place where the library displays a field value outside an input: list cells and display-only form fields. The mask is the first cell rule: it wins over a formatter, an FK label and null (`-`), so neither the value nor whether it is set is shown. `listDisplayLinks` links on such a cell still work (the link text is the mask). Out of scope: `toString` output (operator-defined, or the default `<label> #<pk>`), which is a row label, not a field display.

## Alternatives considered
- Keep echoing the value (decision 013 item 11): discloses the stored value to anyone with `view`.
- Render empty but treat an empty submission as a normal value (null or `required`): every save of an unrelated field would wipe or block on the password.
- A separate "change password" checkbox: more UI for no extra safety.
- Q7 (a): leave list cells to configuration (omit the field from `listDisplay` or add a formatter): the default `listDisplay` (pk + first 4 non-key fields) can show the value without the operator choosing it; rejected by the user.
- Q7: let a formatter run before the mask: would make masking depend on the formatter's behaviour; the user asked for masking wherever values are displayed. An operator who wants a different display for the field can choose another widget.

## Rationale
User decision. Not echoing passwords matches common practice for password inputs (Django's `PasswordInput` has `render_value=False` by default; unverified against current Django docs). Point 2 makes the empty input on the change page safe to submit. It is the one place where data handling depends on the widget, an explicit exception to decision 021, chosen because the widget is what makes the value invisible.

## Consequences
- A nullable field with the `password` widget cannot be cleared to null through the change form; documented in the README behavior notes.
- forms.md (`Widget`, coercion rule 2, zod `.optional()`, `required`), views.md (`FormPage` display-only password; `formatCell` `masked`), routes-handlers.md (Change; List step 4b), test-strategy.md.
- Decision 013 item 11 and decision 021 carry a Changed note pointing here.
- Follow-up code change in `src/forms/widgets.tsx`, `src/forms/coerce.ts`, `src/forms/schema.ts`, `src/forms/fields.ts`, `src/views/form.tsx`, `src/views/format.ts`, `src/routes/list.ts`.
