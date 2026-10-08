# 046: `exclude` also shapes the default `listDisplay`; identity columns are not editable

- Date: 2026-10-08
- Status: accepted

## Context
Two low audit findings about defaults that expose or unlock columns:
- views.findings: without `listDisplay`, the list shows the primary key plus the first four other columns regardless of `exclude`, so a column the operator excluded (an API token, a password hash without the `password` widget) appears in list cells for every user with `view` (src/admin.ts:223).
- data.findings: a non-PK `generatedAlwaysAsIdentity()` / `generatedByDefaultAsIdentity()` column is introspected with `isGenerated: false`, so the forms render it as an editable input. On PG a GENERATED ALWAYS identity rejects explicit values (every change save fails with a generic DB error), and a BY DEFAULT identity can be overwritten by any editor (src/introspect/index.ts:130).
User decision (2026-10-08): `exclude` removes columns from the default list columns when `listDisplay` is unset; non-PK identity columns are non-editable like generated and auto-increment columns.

## Decision
1. Default `listDisplay` (admin.md `ResolvedModel`): take the candidates `[pk.key, ...other field keys in definition order]`, drop every key in `exclude`, and keep the first 5. If that leaves nothing (every column excluded), use `[pk.key]`, so the list always has a column that links to the change page. With nothing excluded the result is the same as before (primary key plus the first four other columns). An explicit `listDisplay` is used as given, even if it names an excluded column. `listDisplayLinks` still defaults to the first `listDisplay` column.
2. Identity columns (introspect.md): `isGenerated` is true when `column.generated` is defined or `column.generatedIdentity` is defined. This covers every identity column; for an identity primary key nothing changes in the forms (already omitted on add and display-only on change through `isAutoIncrement`), but its snapshot shows `isGenerated: true`. A non-PK identity column is omitted on the add page and display-only on the change page, like other generated columns (forms.md table).
3. README: the `listDisplay` default row says excluded columns are skipped; the `exclude` row says it also affects the default list columns; the `readonlyFields` row says identity columns are always display-only.

## Alternatives considered
- Always keep the primary key in the default list even if excluded: the key is in every change URL anyway, but the user asked that `exclude` remove columns; the empty-result fallback covers the only case where the list would lose its link column.
- Keep 4 non-PK columns when the primary key is excluded (4 columns in total): the slot rule is harder to state; "first 5 of the remaining candidates" is one expression.
- Mark only non-PK identity columns as generated: needs a PK condition in the flag; the flag means "the DB generates the value", which holds for both, and the PK case has no behavior change.
- Treat only GENERATED ALWAYS identity as non-editable and keep BY DEFAULT editable: the user asked for non-editable; BY DEFAULT values are sequence-managed and overwriting them can collide with later generated values (unverified).

## Rationale
The default list should not show what the operator removed from the forms, the same reasoning that led to masking `password` columns (decision 037). drizzle exposes identity columns through `generatedIdentity` while `generated` stays undefined (evidence: 2026-10-08-pg-key-input-domains), so the flag must read both.

## Consequences
- admin.md (default `listDisplay`), introspect.md (`isGenerated`), forms.md (table note), project-setup.md (README rows), test-strategy.md (register defaults, PG introspection snapshot of `tags.id`, a non-PK identity column).
- Behavior change for registrations with `exclude` and no `listDisplay`: the list columns change. Recorded in `CHANGELOG.md` (decision 048).
