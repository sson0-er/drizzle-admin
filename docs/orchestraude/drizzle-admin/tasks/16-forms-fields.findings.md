# Review findings

high: 0, medium: 0, low: 8

## high


## medium


## low

- [quality] Redundant guards in the FK branch
  - location: src/forms/fields.ts:130
  - detail: fkChoice is only defined when fk and fk.slug are defined, so the `fk !== undefined && fk.slug !== undefined` checks are repeated just to narrow types, and `fkChoice !== "tooMany"` is re-tested after the if/else already split on it. Extracting the FK handling into a helper that returns {widget, choices, fkFallbackHref}, or setting choices inside the non-tooMany branch, would remove the double checks.
  - evidence: (none)
- [quality] Missing fkChoices entry silently becomes an empty select
  - location: src/forms/fields.ts:127
  - detail: `fkChoices.get(key) ?? []` hides a caller omission by rendering an empty select. Acceptable if routes always supply an entry, but a comment stating why the fallback is empty would clarify intent.
  - evidence: (none)
- [spec] design ambiguity: fkFallbackHref on a non-select FK override with tooMany
  - location: src/forms/fields.ts:137
  - detail: When fkChoices is "tooMany", fkFallbackHref is set for every widget, including a kept `hidden`, `number` or `text` override. The design only covers the default and the `select` override (forms.md, decision 021). A hidden input has no label row, so the link would render beside an invisible field. The implementer's report says the href is set only when the widget was select or default, but the code does not do that. Ask whether non-select overrides should get the link. Then align the code and the report, and add a test for the `hidden` case (the current test checks only the widget).
  - evidence: (none)
- [spec] design ambiguity: FK with slug but no fkChoices entry becomes an empty select
  - location: src/forms/fields.ts:127
  - detail: `fkChoices.get(key) ?? []` turns a missing entry into a select with no options (or just the empty choice). The design says fkChoices is keyed by every FK field that has a slug, so a missing entry looks like a caller bug in routes (task 19). The code hides it instead of surfacing it. Confirm whether the [] fallback is intended, for example for display-only fields on change when routes skip the choice query, or whether a missing entry should throw.
  - evidence: (none)
- [spec] EMPTY_CHOICE export not in the design API
  - location: src/forms/fields.ts:62
  - detail: forms.md#fieldsts does not list an exported `EMPTY_CHOICE` constant. It is harmless, but it adds to the module's public surface. Either keep it module-private or record it in the design if task 19 or the widgets need it.
  - evidence: (none)
- [tests] Override case with active: checkbox cannot fail
  - location: test/fields.test.ts:190
  - detail: In 'replaces the default widget with an explicit override', `active: "checkbox"` equals the default widget and is never asserted, so it exercises nothing. Drop it or override to a different widget and assert.
  - evidence: (none)
- [tests] Untested edge branches in FK handling
  - location: src/forms/fields.ts:130
  - detail: No test for a registered FK whose key is missing from fkChoices (falls back to an empty choice list), for a bigint FK with tooMany (expects number), or for a non-select override on an FK with a valid choices list (override kept, no choices). Add small cases if these behaviors are intended.
  - evidence: (none)
- [tests] refSlugOf test helper mirrors the implementation fallback
  - location: test/fields.test.ts:70
  - detail: The helper returns meta.foreignKey.slug, the same value the implementation falls back to, so the fkFallbackHref assertions do not prove refSlugOf is used. Pass a distinct slug in one test to verify it.
  - evidence: (none)

