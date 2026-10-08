# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] Needless alias and non-null cast in handlers
  - location: src/routes/form.ts:190
  - detail: `const model = found;` is a redundant alias (narrowing already applies to `found`; rename or destructure instead). `result.row as DbRow` in addHandler papers over the `row: DbRow | null` union; splitting the save result type (create vs update) or having save return a discriminated union would remove the cast.
  - evidence: (none)
- [quality] FK slug looked up twice
  - location: src/routes/form.ts:67
  - detail: loadFkChoices scans `model.meta.fields` for foreignKey.slug, then loadGroups passes `refSlugOf` that re-scans the same fields per key. Building a key->slug map once and sharing it would avoid the duplicate lookup.
  - evidence: (none)
- [quality] Redirect target branching duplicates the _addanother/_continue checks
  - location: src/routes/form.ts:167
  - detail: The add and change branches differ only in the priority of _addanother vs _continue; a small ordered-keys choice per mode would be shorter than the nested if/else chain.
  - evidence: (none)
- [security] FK choices disclose labels of a referenced model regardless of its view permission
  - location: src/routes/form.ts:48
  - detail: loadFkChoices calls repo.options on the referenced model and renders up to 200 row labels (ref.toString) without checking can(ref, "view", user). A user with add or view permission on articles but no view permission on authors still sees every author label in the select. This follows routes-handlers.md Add step 2 (and Django's behavior), so it is not a defect here. Consider documenting it in the permissions section, or covering it in task 24's permission matrix so the behavior is a deliberate choice.
  - evidence: (none)
- [spec] design ambiguity: non-DB errors thrown by create/update are rethrown (500) instead of shown as dbOther
  - location: src/routes/form.ts:163
  - detail: Add step 6 in routes-handlers.md says only 'DB error → form error by class (dbUnique, dbForeignKey, dbNotNull, dbOther), 400'. It does not say what happens when repo.create/update throws something for which isDbError is false. The implementation rethrows such errors to onError (500, logged in full). This fits decision 022's split between DB errors and bugs, but the design does not state it. The implementer flagged this in the report. Ask the user to confirm, and if confirmed, record it in routes-handlers.md.
  - evidence: (none)

