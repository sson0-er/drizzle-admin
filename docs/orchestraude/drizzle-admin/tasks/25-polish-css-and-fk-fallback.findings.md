# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] Narrow-screen test asserts overflow-x on the whole stylesheet
  - location: test/views.test.ts:124
  - detail: expect(ADMIN_CSS).toContain('overflow-x: auto') would also pass if the rule only existed outside the 767px block (it probably already exists in the base CSS). That matches the DoD wording, but asserting it on the narrow block, or noting why not, would make the test track the intent.
  - evidence: (none)
- [quality] Unneeded returning() and float: none in new code
  - location: test/form.test.ts:776
  - detail: fillAuthors calls .returning() only to make the insert awaitable and discards the result. In the CSS, `float: none` on #changelist-filter is a no-op when the base rule does not float it (flex layout with order). Drop either if unnecessary.
  - evidence: (none)
- [tests] overflow-x assertion is not scoped to the narrow media block
  - location: test/views.test.ts:124
  - detail: expect(ADMIN_CSS).toContain('overflow-x: auto') passes if the string appears anywhere in the stylesheet, so removing it from the max-width block would not fail the test. Assert it on the `narrow` block instead (the DoD wording is ambiguous, so this is only a hardening).
  - evidence: (none)
- [tests] Dark-mode test checks only a loose pattern
  - location: test/views.test.ts:116
  - detail: The regex /--[a-z-]+:\s*#/ would match any hex custom property in the block. It could assert that a property already defined in the base :root (for example --body-bg) is redefined inside the dark block.
  - evidence: (none)

