# 041: DoD test-diff rules allow import lines that only add names

- Date: 2026-10-08
- Status: accepted

## Context
Task 38's Definition of Done said that in `git diff test/` the only removed lines are the listed checkmark assertions. The implementation also rewrote three existing import lines (`test/format.test.ts` `formatCell` import, `test/views.test.ts` `FormPage` import and its `./helpers/html.js` import) to add the new names, which shows up as removed lines. The reviewer raised it as L013 (`06-low-findings-followup.md`): it was unclear whether such edits break the rule. The rule exists so that a task cannot weaken or delete existing assertions unnoticed.

## Decision
User decision (2026-10-08, `06-low-findings-followup-triage.md` section B, L013).
1. A task-authoring convention: when a task DoD restricts the removed lines in `git diff test/` to a listed set, an edit to an existing import line (an `import ... from ...` statement, including one spread over several lines) is an allowed exception if the only change is adding new imported names. Removing or renaming an imported name, or changing the module specifier, is not covered and still counts as a removed line under the rule.
2. Task 38's three import-line edits are accepted under this rule; no follow-up change is needed.
3. Planners writing such a DoD either state the exception explicitly or refer to this decision.

## Alternatives considered
- Keep the strict rule and require new names to be imported in a separate, added import statement: avoids the exception but produces duplicate imports from the same module, which the lint setup and readers dislike, for no extra safety.
- Drop the removed-lines rule: loses the guard against silently weakened assertions.

## Rationale
User decision. Adding names to an import cannot weaken an assertion; the rule's purpose (no existing assertion removed or changed beyond the listed ones) is preserved. Whether Biome flags duplicate imports from one module is unverified; the preference against them is a readability reason.

## Consequences
- 04-plan.md "Definition of Done shared by all tasks" points to this decision.
- Reviewers do not raise import-line edits that only add names under such a DoD.
