# Review findings

high: 0, medium: 0, low: 3

## high


## medium


## low

- [spec] Trimmed number input is still named `trimmed`, not `s`
  - location: src/forms/coerce.ts:34
  - detail: forms.md coerceForm rule 3 (Changed 2026-10-09) and the task notes say the trimmed number input is named `s`. The code keeps the existing name `trimmed`. That name does not shadow `t` either, so the purpose of the rule is met and behavior is identical. Either rename it to `s` to match the design text, or have the design say only that the name must not shadow `t`.
  - evidence: (none)
- [spec] design ambiguity: DoD says nine readLocale rows but the design lists eight
  - location: test/locale.test.ts:8
  - detail: The task DoD and notes say 'the nine readLocale rows', but test-strategy.md and the task's own list give eight Cookie-header cases (none, ja, en, fr, JA, empty, %E0%A4%A, ja;en). The implementer wrote the eight rows and added a separate LOCALE_COOKIE pin as the ninth case. The behavior is fully covered. The orchestrator should correct the count in the task/design, or confirm the LOCALE_COOKIE pin is the intended ninth case.
  - evidence: (none)
- [tests] typeof-function check implied by formatted rows
  - location: test/messages.test.ts:117
  - detail: The 'has a function for %s' typeof test is mostly implied by the key-set equality test and the formatted-message rows. Only keys not in the formatted table (e.g. changed/deleted for en) rely on it. Optional: drop it or call each function in the table.
  - evidence: (none)

