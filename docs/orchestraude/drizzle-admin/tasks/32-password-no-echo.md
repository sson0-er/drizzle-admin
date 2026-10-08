---
id: 32-password-no-echo
depends_on: [31-password-keep-on-empty, 28-fk-reference-view-permission]
status: pending
attempts: 0
---
# Task 32: password-no-echo

## Goal
The value of a `password`-widget field never appears in the HTML (decision 037 points 1, 4, 5):
- the `<input type="password">` always renders empty, on the change GET and on every 400 re-render;
- a display-only field shows `********`;
- the field's list cells show `********`, a rule that wins over a formatter, an FK label and null.

## Scope
### Files to touch
- src/forms/widgets.tsx
- src/views/format.ts
- src/routes/list.ts
- test/widgets.test.ts
- test/format.test.ts
- test/views.test.ts
- test/password-widget.test.ts (created by task 31)
### Do not touch
- src/forms/coerce.ts, src/forms/schema.ts, src/forms/fields.ts (task 31)
- src/views/form.tsx (it already renders display-only fields through `DisplayValue`; change it only if the views test proves that necessary, and say why in History)
- `toString` row labels (out of scope per decision 037 point 5)
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- `widgets.tsx` `Input`, case `password`: render `<input type="password" name id>` with no `value` attribute (or `value=""`), whatever the `value` prop is (forms.md "Rendering" table).
- `widgets.tsx` `DisplayValue`: when `field.widget === "password"`, render the fixed mask `********` instead of `formatValue(...)` (forms.md `widgets.tsx`, last paragraph). `FormPage` uses `DisplayValue` for display-only fields, so a view-only change page is covered (views.md `FormPage`).
- `format.ts` `formatCell` gains `masked?: boolean`. Rule 0, before the formatter: `masked` → `********`, whatever the value (null included), the formatter or `fkLabel` (views.md `format.ts`).
- `src/routes/list.ts` step 4b: pass `masked: model.widgets[key] === "password"` to `formatCell`. A `listDisplayLinks` link on such a cell still applies, with the mask as its text.
- The mask string is a glyph-only literal (decision 033 item 11), so it does not go into `messages.ts`. Two copies (format.ts and widgets.tsx) are within the duplication convention. If you export one constant from `format.ts` instead, record the export in History.
- Integration (test-strategy.md "Password widget"): extend `test/password-widget.test.ts`. Force the 400 re-render with a `validate` that returns an error for `value` (`kv` registered with `widgets: { value: "password" }`, `validate: () => ({ value: "x" })` or similar). For the list, register `kv` with `listDisplay: ["key", "value"]`.
- CLAUDE.md conventions apply.

## Definition of Done
- [ ] Tests: `test/widgets.test.ts`. `Widget` for a `password` field with `value="stored"` renders an `input[type=password]` whose HTML does not contain `stored`. `DisplayValue` of a `password`-widget field with value `"stored"` renders `********` and not `stored`.
- [ ] Tests: `test/format.test.ts`, it.each. `masked: true` gives `********` for a string value, for `null`, with a formatter, and with an `fkLabel`.
- [ ] Tests: `test/views.test.ts`. `FormPage` with a display-only `password` field and `displayRow` value `"stored"` shows `********` in that `div.form-row` and does not contain `stored`.
- [ ] Tests: `test/password-widget.test.ts`, both dialects, row `a` = `s3cret`:
  - the change page HTML does not contain `s3cret`, and `input[name=value]` has no `value` attribute or an empty one;
  - a change POST with `value=typed` that `validate` rejects answers 400, and the HTML does not contain `typed`;
  - with `listDisplay: ["key", "value"]`, the `kv` list cell for `value` reads `********`, and the list HTML does not contain `s3cret`;
  - a view-only change page (`permissions: { change: false }`) shows `********` and does not contain `s3cret`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (section "`widgets.tsx`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (sections "`format.ts`" and "`FormPage` props")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (section "List" step 4b)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (views row; Integration coverage "Password widget")
- Decisions: docs/orchestraude/decisions/037-password-widget-no-echo.md (points 1, 4, 5), docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 11)

## History
