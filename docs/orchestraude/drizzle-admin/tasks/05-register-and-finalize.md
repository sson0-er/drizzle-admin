---
id: 05-register-and-finalize
depends_on: [04-public-types-and-create-admin]
status: pending
attempts: 0
---
# Task 05: register-and-finalize

## Goal
`admin.register(table, options)` introspects, validates and stores a `ResolvedModel`. The first access of `admin.app` / `admin.fetch` finalizes the registry (FK slugs, cross-model checks, freeze) and builds the app once. Every configuration error is thrown synchronously with a descriptive `drizzle-admin:` message.

## Scope
### Files to touch
- src/admin.ts (register, finalize, `app` getter, `fetch`)
- src/forms/fields.ts (only `allowedWidgets(meta)` in this task)
- src/routes/index.ts (temporary stub `buildApp(state)`, replaced in task 14)
- test/register.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/types.ts except adding internal types missing for `ResolvedModel` (do not change public types)
- src/index.ts, src/introspect/**, src/time.ts, src/messages.ts

## Implementation notes
- Steps 1-6 of `register`, the defaults of `ResolvedModel`, and finalization: `interfaces/admin.md` sections "admin.register", "Finalization" and "ResolvedModel". The error message formats there are tested by substring.
- `allowedWidgets(meta)`: the table in `interfaces/forms.md#fieldsts` (first matching row wins; kind unknown → none). Task 16 adds the rest of fields.ts to this file.
- `listFilter` accepts kind boolean/enum/date, `isDateOnly` (PG `date()` string mode) or a field with `foreignKey` (decision 023). `searchFields` accepts kind string/enum.
- Finalization runs once (idempotent): resolve `foreignKey.slug`, check FK `listFilter` keys and FK `select` widget overrides, freeze, then call `buildApp(state)` once. `admin.fetch(request)` = `new Hono().route(prefix || "/", app).fetch(request)`, built once.
- Stub `buildApp(state: AdminState): Hono` returns `new Hono()` with no routes. Task 14 replaces it with the real app; keep the signature from `interfaces/routes.md#api`.
- `permissions`: boolean `b` → `() => b`; undefined → `() => true`; a function is kept.

## Definition of Done
- [ ] Tests: `test/register.test.ts` covers each register error with the substrings from admin.md: register after `admin.app` was accessed; unknown column for each option (`listDisplay`, `listDisplayLinks`, `searchFields`, `listFilter`, `ordering` with `-`, `fields`, `exclude`, `readonlyFields`, `fieldsets[i].fields`, `widgets` key, `formatters` key); duplicate slug; reserved slugs `login`, `logout`, `static`; invalid slug characters; listFilter on a string field; searchFields on a number field; `fields` with `fieldsets`; duplicate, empty and `delete_selected` action names; `listPerPage` 0 and 1.5; composite PK and dialect mismatch propagate from introspection.
- [ ] Tests: `test/register.test.ts` covers widget overrides: one rejected and one accepted override per `allowedWidgets` row (e.g. `checkbox` on a string field rejected with `widget "checkbox" is not allowed for field`, `textarea` on json accepted); on PG `events.due` (`date()`), `listFilter: ["due"]` and widget `date` are accepted and `textarea` is rejected.
- [ ] Tests: `test/register.test.ts` covers finalization: `foreignKey.slug` is set when the referenced table is registered; FK `listFilter` to an unregistered table throws on first `admin.app` access with `needs the referenced table to be registered`; widget `select` on an FK to an unregistered table throws at finalization; `admin.app` returns the same instance on repeated access.
- [ ] Tests: `test/register.test.ts` checks `ResolvedModel` defaults (label, listDisplay = pk + first 4 non-pk keys, listDisplayLinks, listPerPage 50, fieldsets with `exclude` applied, toString `"<label> #<pk>"`, permissions default true) through an internal accessor exported from `src/admin.ts`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md#fieldsts (`allowedWidgets` table)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md#api (`buildApp` signature)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "admin")
- Decisions: docs/orchestraude/decisions/006-routing-and-mounting.md, 013-unspecified-page-behaviors.md (items 3, 13), 021-widget-override-compatibility.md, 023-pg-date-string-mode-support.md

## History
