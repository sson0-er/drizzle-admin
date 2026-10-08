# Review findings

high: 0, medium: 0, low: 9

## high


## medium


## low

- [quality] Needless intermediate variable in confirmPage
  - location: src/routes/actions.ts:48
  - detail: `const title = actionLabel;` only aliases a parameter. Use actionLabel directly in pageChrome and the breadcrumb, and make the arrow function body an expression.
  - evidence: (none)
- [quality] Custom confirm page can list zero rows
  - location: src/routes/actions.ts:102
  - detail: The delete branch returns a noSelection warning when getMany finds no rows, but the custom confirm branch renders an empty confirmation list in the same case. Consider handling the two the same way for consistency.
  - evidence: (none)
- [security] Custom actions receive raw, unvalidated ids
  - location: src/routes/actions.ts:104
  - detail: delete_selected only touches rows that getMany resolves through parsePks, but custom.run gets the deduped `_selected` strings exactly as the client posted them: unparsed, possibly ids that don't exist, and with no limit on how many. This follows the design (`run({ ids, db, user })`), but action authors may assume the ids are valid pks. Consider documenting that `ids` is untrusted input that `run` must validate, or passing only the ids getMany resolved.
  - evidence: (none)
- [security] Unknown-action check runs before the permission check
  - location: src/routes/actions.ts:98
  - detail: A user without `change` permission gets an 'unknownAction' flash for a name that doesn't exist and a 403 for one that does, so they can tell which custom action names exist. Action names are not sensitive, so the impact is negligible. Consider checking ACTION_PERMISSION before the name lookup if the response should not depend on whether the action exists.
  - evidence: (none)
- [spec] design ambiguity: ConfirmActionPage takes an extra listHref prop
  - location: src/views/confirm-action.tsx:13
  - detail: views.md lists the ConfirmActionPage props as `modelLabel; action; actionLabel; isDelete; items; backQuery`, but the form must post to "list URL + backQuery", and PageChrome carries no model slug. The implementation adds `listHref: string` to the public props. That is reasonable, but it is an interface addition the design does not list. Either update views.md to include listHref, or ask the user whether the page should build the URL some other way.
  - evidence: (none)
- [spec] design ambiguity: delete_selected with no surviving rows flashes noSelection
  - location: src/routes/actions.ts:68
  - detail: routes-handlers.md says that for delete_selected, no `_confirm` gives `rows = repo.getMany(...)` and then ConfirmActionPage 200, and `_confirm=1` gives `repo.delete(pks of rows)` and then `deletedMany(n)`. The design does not say what happens when getMany returns no rows. The implementation adds a branch that returns a noSelection warning and a 303 in both cases, instead of an empty confirmation page or `deletedMany(0)`. No test covers this branch directly; the 403 test only reaches it through `_selected: "999"`. Confirm the behavior with the user and record it in the design. If it is kept, add an explicit test.
  - evidence: (none)
- [tests] Vanished-rows branch of delete_selected is untested
  - location: test/delete.test.ts:150
  - detail: actions.ts warns noSelection when getMany returns no rows (all selected ids missing). The permission test posts id 999 but asserts only status != 403. Add a case with a nonexistent id asserting the noSelection warning flash and 303.
  - evidence: (none)
- [tests] dbOther and non-DB error rethrow paths unreached
  - location: test/delete.test.ts:150
  - detail: Bulk delete tests cover dbForeignKey only. The dbOther flash and the rethrow of non-DB errors are not exercised. Optionally cover via a repo failure or a stubbed delete.
  - evidence: (none)
- [tests] Permission test mixes several scenarios in one case
  - location: test/actions.test.ts:196
  - detail: One test checks four permission outcomes, and the delete_selected assertion `not.toBe(403)` is weak. Splitting it and asserting the exact status (for example the noSelection 303) would give clearer failure messages.
  - evidence: (none)

