# Review findings

high: 0, medium: 0, low: 7

## high


## medium


## low

- [quality] Redundant branches in toFormValue
  - location: src/forms/widgets.tsx:25
  - detail: The `number`/`bigint` case and the `default` branch both reduce to `String(value)`, and `typeof value === "string" ? value : String(value)` is just `String(value)`. Drop the number/bigint case and simplify default to `return String(value)`, keeping the decision 023 comment.
  - evidence: (none)
- [quality] Duplicated Widget JSX for hidden vs visible fields
  - location: src/views/form.tsx:44
  - detail: The same `<Widget field value error />` element is written twice (hidden branch and inside the form-row). Build the widget element once per field, then wrap it in the row only when not hidden.
  - evidence: (none)
- [quality] Unused props mode and modelLabel in FormPage
  - location: src/views/form.tsx:6
  - detail: `mode` and `modelLabel` are declared but never read by the component. They come from the design's prop table so this is acceptable, but note that they have no effect.
  - evidence: (none)
- [spec] design ambiguity: FormPage takes an extra required timeZone prop
  - location: src/views/form.tsx:20
  - detail: The views.md FormPage row lists `mode; modelLabel; groups; values; fieldErrors; formErrors; canSave; deleteHref?; displayRow?` and does not include `timeZone`. The prop is still needed: FormPage renders display-only fields through DisplayValue, and forms.md gives DisplayValue a required `timeZone`. The implementer recorded this in History. The orchestrator should confirm the addition and add `timeZone` to the views.md Pages table so the routes task (which builds FormPage props) knows to pass it.
  - evidence: (none)
- [spec] design ambiguity: hidden-widget rows are skipped only for editable fields
  - location: src/views/form.tsx:43
  - detail: forms.md says a `hidden` widget has 'no label row'. The code skips `div.form-row` only when the field is editable and its widget is hidden. A display-only field with a hidden widget override, such as a hidden FK in change mode without canChange, still gets a labelled row with its DisplayValue. This seems reasonable because nothing is submitted for it, but the design does not cover the case. Confirm the intended behavior, or render display-only hidden fields without a row too.
  - evidence: (none)
- [tests] Per-widget id/name/required check uses a loose substring assertion
  - location: test/widgets.test.ts:150
  - detail: expect(html).not.toContain("required") would also fail on a legitimate value or label containing the word, and the loop value is always empty. Prefer asserting attr(el, "required") is null on the parsed control. Also the id/name loop duplicates the per-widget tests; fine, but the select case has no choices so it is never rendered with options.
  - evidence: (none)
- [tests] DisplayValue lacks date-only and json cases
  - location: test/widgets.test.ts:262
  - detail: DisplayValue is only checked for text, null, boolean and timestamp. A date-only Date (timezone-independent rendering) is the zone-sensitive path and has no display test; add one parameterized over zones.
  - evidence: (none)

