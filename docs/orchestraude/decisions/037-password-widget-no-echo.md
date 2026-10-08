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
6. Changed 2026-10-08 (user answer to L011 and L010, 06-low-findings-followup-triage.md section B): a list column whose widget is `password` is not sortable. Its header shows the key as plain text with no sort link (`data-sort="none"`), and `?o=` silently drops that key (other keys in the same `o` still apply; no error, no flash). Sorting would otherwise group NULL and set values and order rows by the stored value. A masked cell never gets the FK auto-link either: the href would contain the raw value and its absence for null would show whether a value is set. `register()` already rejects `password` on FK columns (`allowedWidgets`), so the FK rule is defense in depth (evidence: 2026-10-08-masked-list-column-sort-and-fk-link). The `listDisplayLinks` link to the row's own change page stays (its href holds the primary key, not the masked value). Only the request parameter `o` is restricted here; the `ordering` option is covered by point 7.
7. Changed 2026-10-08 (user answer to Q12, option (a) for all three): `register()` throws a descriptive error when a field with the `password` widget is (1) in `searchFields` (`?q=` would match on the stored value, so it could be probed substring by substring), (2) in the `ordering` option in either direction (the default list order would group NULL vs set and order by the value), or (3) the primary key (the key appears in change URLs, `_selected` values and the default `toString`). Messages and check order are in admin.md `register` step 5 (evidence: 2026-10-08-masked-list-column-sort-and-fk-link).

## Alternatives considered
- Keep echoing the value (decision 013 item 11): discloses the stored value to anyone with `view`.
- Render empty but treat an empty submission as a normal value (null or `required`): every save of an unrelated field would wipe or block on the password.
- A separate "change password" checkbox: more UI for no extra safety.
- Q7 (a): leave list cells to configuration (omit the field from `listDisplay` or add a formatter): the default `listDisplay` (pk + first 4 non-key fields) can show the value without the operator choosing it; rejected by the user.
- Q7: let a formatter run before the mask: would make masking depend on the formatter's behaviour; the user asked for masking wherever values are displayed. An operator who wants a different display for the field can choose another widget.
- L011: keep the column sortable and record the NULL-vs-set grouping as accepted in review-policy.md: rejected by the user (contradicts point 5).
- L011 representation: a separate `sortable: boolean` on each `ListPage` column, or `sortHref: string | null` with `null` meaning "no sort link" (chosen). One nullable field cannot get out of sync with a flag, and a column without a link has no href to compute.
- Q12 (b): accept the three configurations as operator choices and document them in the README; (c) leave as is: rejected by the user. A register-time error is cheap and catches the mistake before any page is served.
- L010: rely on `allowedWidgets` alone (no `masked` check in the list cell loop): rejected, because the cell loop should not depend on a check in another module for a security property, and the extra condition costs one boolean.

## Rationale
User decision. Not echoing passwords matches common practice for password inputs (Django's `PasswordInput` has `render_value=False` by default; unverified against current Django docs). Point 2 makes the empty input on the change page safe to submit. It is the one place where data handling depends on the widget, an explicit exception to decision 021, chosen because the widget is what makes the value invisible.
Point 6 (Changed 2026-10-08): user decision on L011 and L010. The code facts it rests on (every `listDisplay` key accepted by `o`, FK link not checking the mask, `password` not allowed on FK columns) are in evidence 2026-10-08-masked-list-column-sort-and-fk-link.

## Consequences
- A nullable field with the `password` widget cannot be cleared to null through the change form; documented in the README behavior notes.
- forms.md (`Widget`, coercion rule 2, zod `.optional()`, `required`), views.md (`FormPage` display-only password; `formatCell` `masked`), routes-handlers.md (Change; List step 4b), test-strategy.md.
- Decision 013 item 11 and decision 021 carry a Changed note pointing here.
- Point 6 (Changed 2026-10-08): views.md `ListPage` `columns[].sortHref` is `string | null`; routes-handlers.md List steps 2, 4b and 7; test-strategy.md; project-setup.md README outline section 9. Point 7 (Changed 2026-10-08): admin.md `register` step 5, test-strategy.md (admin register cases), project-setup.md README outline section 6; follow-up code change in `src/admin.ts`. Follow-up code change in `src/routes/list.ts` and `src/views/list.tsx`.
- Follow-up code change in `src/forms/widgets.tsx`, `src/forms/coerce.ts`, `src/forms/schema.ts`, `src/forms/fields.ts`, `src/views/form.tsx`, `src/views/format.ts`, `src/routes/list.ts`.
