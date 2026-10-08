---
id: 31-password-keep-on-empty
depends_on: [28-fk-reference-view-permission]
status: done
attempts: 0
---
# Task 31: password-keep-on-empty

## Goal
On the change page, an editable field whose widget is `password` keeps its stored value when it is submitted empty or not at all. The key is left out of the update data, zod accepts its absence, and the field is not marked required. A non-empty submission is saved as usual, and add mode is unchanged (decision 037 points 2 and 3). This prepares task 32, which stops rendering the value, so that saving an unrelated field cannot wipe the password.

## Scope
### Files to touch
- src/forms/coerce.ts
- src/forms/schema.ts
- src/forms/fields.ts
- test/coerce.test.ts
- test/schema.test.ts
- test/fields.test.ts
- test/password-widget.test.ts (new; task 32 extends it)
### Do not touch
- src/forms/widgets.tsx, src/views/**, src/routes/** (rendering is task 32; the change handler needs no change because `repo.update` only writes the keys in `data`)
- Coercion of every other widget and kind
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- `coerceForm` rule 2 (forms.md `coerce.ts`): when `raw` is missing or exactly `""` and `field.widget === "password" && mode === "change"`, omit the key from `data` before the `!notNull` → `null` branch. Add mode keeps rule 2 as it is (null, omitted with a default, or `required`).
- `buildZodSchema` (forms.md `schema.ts`): `.optional()` also when `mode === "change"` and `field.widget === "password"`.
- `buildFormGroups` (forms.md `fields.ts`): `required` is false when `mode === "change"` and the final widget is `password`.
- This is the one deliberate exception to "data handling never depends on the widget" (decision 021, amended by decision 037). Add a short why-comment at the coercion branch that cites decision 037.
- Integration fixture (test-strategy.md "Password widget"): `kv` registered with `widgets: { value: "password" }`. Set row `a` to `value = "s3cret"` through the test's db before the requests. `kv.value` is a nullable text column. Use `describe.each(dialects)`.
- CLAUDE.md conventions apply (it.each tables for the coercion cases).

## Definition of Done
- [ ] Tests: `test/coerce.test.ts`, it.each over an editable `password`-widget string field:
  - change + `""` → key absent from `data`, no error;
  - change + key missing → key absent, no error;
  - change + `"new"` → `data.value === "new"`;
  - add + `""` on a nullable field → `null`;
  - add + `""` on a notNull field without default → `messages.required`.
- [ ] Tests: `test/schema.test.ts`. In change mode the schema of a notNull `password`-widget field accepts `{}`. In add mode the same schema rejects `{}`.
- [ ] Tests: `test/fields.test.ts`. A notNull field with a `password` override has `required: false` in change mode and `required: true` in add mode (no default).
- [ ] Tests: `test/password-widget.test.ts` (new), both dialects, `kv` with `widgets: { value: "password" }` and row `a` = `s3cret`:
  - `POST /admin/kv/a/change/` with `value=""` → 303, and the stored value is still `s3cret`;
  - with `value=new` → 303, and the stored value is `new`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (sections "`coerce.ts`" rule 2, "`schema.ts`", "`fields.ts`" `required`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (section "Change" step 4)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (forms row "password widget"; Integration coverage "Password widget")
- Decisions: docs/orchestraude/decisions/037-password-widget-no-echo.md (points 2, 3), docs/orchestraude/decisions/021-widget-override-compatibility.md

## History
