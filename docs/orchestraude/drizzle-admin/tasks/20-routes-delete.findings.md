# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] enc helper triplicated
  - location: src/routes/delete.ts:17
  - detail: The same `enc` one-liner already exists in list.ts and form.ts; delete.ts adds a third copy. Could be shared from context.ts later (context.ts is off-limits for this task, so follow up separately).
  - evidence: (none)
- [spec] design ambiguity: success flash when repo.delete removes 0 rows
  - location: src/routes/delete.ts:57
  - detail: The return value of repo.delete (number of deleted rows) is ignored. If the row disappears between repo.get and repo.delete (concurrent delete), the handler still flashes messages.deleted(label). The design (routes-handlers.md Delete step 3) does not say what to do when the count is 0 (success flash, 404, or another message). The current behavior is reasonable; the orchestrator may ask the user whether a 0 count needs different handling.
  - evidence: (none)
- [tests] dbOther and non-DB error branches untested
  - location: test/delete.test.ts
  - detail: The handler has a dbOther flash branch and a rethrow for non-DB errors. Neither is tested. The DoD does not require them, so this is optional. A repo stub that throws could cover both.
  - evidence: (none)
- [tests] Cancel-link and form assertions fail with unclear messages
  - location: test/delete.test.ts:92
  - detail: `cancel as Node` and `form as Node` cast a possibly-null result. A missing element fails with a TypeError, not an assertion naming the cause. Assert not-null before use, or use a helper that throws a descriptive error. The 404 test also bundles three cases (unknown pk on GET, unknown pk on POST, unknown model) in one `it`. Splitting them or using `it.each` would show which one failed.
  - evidence: (none)

