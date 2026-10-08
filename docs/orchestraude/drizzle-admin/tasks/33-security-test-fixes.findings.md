# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] Typed db cast duplicated between permissions and XSS describes
  - location: test/auth.test.ts:444
  - detail: The permissions describe adds a raw() insert/select cast while the XSS describe keeps its own insert cast with returning(). Two copies are within the accepted duplication limit, so this is only a note: a shared module-level helper would remove them if a third copy appears.
  - evidence: (none)
- [security] Denied add-POST case does not check that no row was inserted
  - location: test/auth.test.ts:518
  - detail: In the 403 matrix, the before/after `rowsOf(id)` check reads the fresh author's row. A denied `POST /admin/authors/add/` would insert a new `added-<id>` row, which that check does not see. The exact 403 assertion still catches a bypassed gate, so this is only a missing extra check. To close it, assert that no author named `added-<id>` exists after the denied request.
  - evidence: (none)
- [spec] 403-matrix test titles render the path as "[Function path]"
  - location: test/auth.test.ts:513
  - detail: `path` is now a function, so the `$path` placeholder in the it.each title prints "[Function path]". The two view-GET cases now have identical names ("view false: GET [Function path] -> 403, allowed -> 200"), and so do the two delete-POST cases apart from the allowed status. A failure report no longer says which route broke. Add a `label` string field to each case (for example "/admin/authors/:id/change/") and use `$label` in the title.
  - evidence: (none)
- [tests] Denied add POST is not checked for a created row
  - location: test/auth.test.ts:476
  - detail: The matrix compares the pre-created author before and after the denied request. For the add case (POST /admin/authors/add/) that comparison cannot show whether the denied request inserted a new row named added-<id>. If the gate leaked after inserting, the 403 would still pass the test. Query for a row named added-<id> and assert it is absent after the denied request.
  - evidence: (none)
- [tests] Page-wide script assertion is implied by the form-scoped one
  - location: test/auth.test.ts:699
  - detail: The new form-scoped script check sits next to the existing document-wide `qsa(doc, script)` length check. Keeping both is harmless, but the document-wide check covers the form one. Drop the form-scoped check or keep it deliberately as the DoD wording.
  - evidence: (none)

