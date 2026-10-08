# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] cellBoolean re-encodes formatCell precedence rules
  - location: src/views/format.ts:62
  - detail: cellBoolean repeats the masked/formatter/fkLabel precedence checks of formatCell, so the two must be kept in sync by hand. Could be derived from a shared rule helper. Also, in list.ts the formatCell and cellBoolean calls could be one step returning text plus bool.
  - evidence: (none)
- [quality] Unreachable Object.hasOwn guard in Icon
  - location: src/views/icons.tsx:39
  - detail: name is typed as IconName, so the guard is dead code for typed callers; the comment admits it is cast-only. Acceptable defensive code, but it is a branch that exists only for a case the type system excludes.
  - evidence: (none)
- [spec] design ambiguity: DoD test-diff rule does not allow for edited import lines
  - location: test/format.test.ts:3
  - detail: The DoD says the only removed lines in `git diff test/` are the checkmark assertions in widgets.test.ts and list.test.ts (plus the list test title). The diff also rewrites three existing import lines (test/format.test.ts `formatCell` import, test/views.test.ts `FormPage` import and the `./helpers/html.js` import) to add the new names. No assertion changes, the edit is needed to import the new symbols without duplicate imports, and the implementer recorded it in History. Either accept it as within the intent of the rule or word future DoDs to allow import-line edits.
  - evidence: (none)
- [tests] aria-hidden test depends on state filled by earlier tests
  - location: test/views.test.ts:722
  - detail: The final 'marks every svg rendered above as aria-hidden' test reads the shared `rendered` array that earlier tests fill. It fails or passes vacuously if run alone (`-t`, shuffle), and the failure does not name the page. Check aria-hidden inside the shared `render` helper, or render the pages in this test.
  - evidence: (none)
- [tests] Flash XSS test does not assert the text is kept as text
  - location: test/views.test.ts:707
  - detail: The case with `<svg onload=alert(1)>` as flash text only asserts the icon list equals ['circle-alert']. Also assert that `text(li)` contains the literal string, as the cell XSS test does, so a dropped message would fail.
  - evidence: (none)
- [tests] Flash icon integration only covers the success level
  - location: test/form.test.ts:258
  - detail: The integration test checks only the success flash. Warning and error levels are covered at the view level, so this is acceptable, but nothing asserts the message text survives next to the icon on a real page.
  - evidence: (none)

