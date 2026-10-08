# 030: `FormPage` takes a required `timeZone`; `values` and `displayRow` are separate sources

- Date: 2026-10-08
- Status: accepted

## Context
Task 18 implemented `FormPage` (src/views/form.tsx) with a required `timeZone: string` prop that interfaces/views.md did not list. Display-only fields render through `DisplayValue`, which formats date-times with `formatValue(meta, value, timeZone)`, so the page cannot render them without a zone (evidence: 2026-10-08-formpage-timezone-prop). The design also did not spell out that `values` holds form strings while `displayRow` holds the stored row.

## Decision
- views.md: `FormPage` props include `timeZone: string` (required). `values: Record<string, string>` feeds editable widgets (strings from `toFormValue` on GET, echoed request strings on a 400 re-render). `displayRow?: Record<string, unknown>` is the stored row and feeds display-only fields only.
- routes-handlers.md: the add and change handlers pass `timeZone: state.config.timeZone` (the resolved `AdminConfig.timeZone`) on every `FormPage` render. Change passes `displayRow: row` on GET and on the 400 re-render. Add passes no `displayRow`.

## Alternatives considered
- Read the zone inside the view from a context or global: views take plain props only (views.md "Render every page from plain props"), so this would break that rule.
- Pre-format display-only values in the handler and pass strings: moves `DisplayValue` formatting out of the forms widgets and duplicates `formatValue` call sites. It would also diverge from the task 18 code.
- Make `timeZone` optional with a server-local default: the resolved config already has a zone, and an optional prop would let a handler silently use the wrong one.

## Rationale
This follows the user's policy for internal API gaps found during implementation (task 14: update the design to match the implementation; see decisions 027 and 028). The required prop matches the code (evidence: 2026-10-08-formpage-timezone-prop). Using the same `state.config.timeZone` for `toFormValue`, `validateSubmission` and `DisplayValue` keeps editable and display-only date-times in one zone.

## Consequences
- views.md "Pages" table and a new `FormPage` props block; routes-handlers.md Add steps 3-4 and Change steps 3-4.
- The task that implements src/routes/form.ts must pass `timeZone` and, for change, `displayRow`.
