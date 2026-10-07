# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] Widget column lookup repeated
  - location: src/admin.ts:174
  - detail: Widget keys are validated with column('widgets', key) in the first loop and looked up again with column('widgets', key) in the later allowedWidgets loop. Build the (key, field, widget) tuples once in the first pass and reuse them. The same applies to the option-column calls whose results are discarded: columns() is used only for its side-effect throw, which is easy to misread.
  - evidence: (none)
- [quality] resolveModel does several jobs
  - location: src/admin.ts:129
  - detail: resolveModel is about 120 lines: slug validation, column checks, type checks, defaults. Splitting validation (validateOptions) from default resolution would make the intent clearer.
  - evidence: (none)
- [quality] Registry not frozen, task notes say freeze
  - location: src/admin.ts:299
  - detail: Finalization does not freeze models; only the register-after-app guard prevents mutation. If a real freeze is not intended, the behavior is fine, but the finalize comment should say so. Also, the FK check 'field?.foreignKey !== undefined && !isPlainFilter(field)' re-tests isPlainFilter, which was already settled at registration.
  - evidence: (none)
- [spec] design ambiguity: registry stays open after a failed finalization
  - location: src/admin.ts:309
  - detail: finalize() sets `app` only after resolveForeignKeys and buildApp succeed. If the first admin.app/admin.fetch access throws (e.g. FK listFilter to an unregistered table), the registry is not treated as finalized: register() is still accepted, and a later access retries finalization. admin.md step 1 ('If finalized') and decision 006 ('register() after finalization throws') do not say whether a failed finalization counts as finalized. The current behavior is reasonable (it lets callers fix the setup by registering the missing table), but the orchestrator may want to confirm it with the user and record it in admin.md.
  - evidence: (none)
- [tests] fetch test cannot distinguish mounting from a missing route
  - location: test/register.test.ts:346
  - detail: The 404 assertion on /admin/anything would pass whether or not the prefix mounting works, since the stub has no routes. It only proves fetch does not throw. Consider asserting the stub's behavior differently, or defer prefix coverage to task 14.
  - evidence: (none)
- [tests] Widget override tests assert accept/reject per kind with several one-line helpers per case
  - location: test/register.test.ts:204
  - detail: The per-row tests in 'register: widget overrides' partly duplicate the allowedWidgets table test (line 177). Could be one parameterized table of [table, key, widget, ok]. Style only.
  - evidence: (none)

