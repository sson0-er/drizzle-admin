---
id: 04-public-types-and-create-admin
depends_on: [02-support-time, 03-introspect]
status: pending
attempts: 0
---
# Task 04: public-types-and-create-admin

## Goal
The public types (§5.2 plus `publicOrigin` and `HookCtx`) and the internal `ResolvedModel` / `AdminState` types exist. `createAdmin(config)` validates and normalizes the config. `src/index.ts` exports exactly the public API. Nonexistent column names in options are compile errors.

## Scope
### Files to touch
- src/types.ts
- src/admin.ts (createAdmin and config normalization only)
- src/index.ts (replace the placeholder)
- test/config.test.ts
- test/types.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/introspect/**, src/time.ts, src/messages.ts
- package.json and every config file

## Implementation notes
- Types: copy from `interfaces/admin.md` "Public types" verbatim, including `AdminConfig.publicOrigin?: string` (decision 017) and `HookCtx` (decision 015). `Table` is `import type { Table } from "drizzle-orm"`. If Biome flags the unused `T` of `AdminAction<T>`, suppress it with a reasoned `biome-ignore`.
- Put `ResolvedModel` and `AdminState` (admin.md "Data formats") in `src/types.ts` but do not export them from `src/index.ts`.
- `createAdmin(config)`: implement every row of the validation table in admin.md (db, dialect, secret length >= 32, basePath → `prefix`, auth, sessionMaxAgeSec default 28800, timeZone via `resolveTimeZone`, siteTitle default `messages.defaultSiteTitle`, publicOrigin normalized to `new URL(v).origin` or `null`). Every failure throws `Error("drizzle-admin: <message>")`. Derive `authMode` (`getUser` wins).
- `register`, `app` and `fetch` are implemented in task 05. In this task the returned `Admin` object may implement them as throwing `Error("drizzle-admin: not implemented")`; task 05 replaces them.
- `src/index.ts` exports exactly what admin.md "Exports of src/index.ts" lists.
- `test/types.test.ts` is checked by `pnpm typecheck`. Write `@ts-expect-error` cases against `ModelAdminOptions<typeof authors>` object literals (fixtures from task 03), so they do not need `register()`. Vitest also runs this file, so it must contain at least one runtime `it` (for example asserting that `createAdmin` returns an object with `register`).

## Definition of Done
- [ ] `src/index.ts` exports `createAdmin` and the types `Admin, AdminConfig, AuthConfig, AdminUser, ModelAdminOptions, AdminAction, WidgetType, HookCtx, ColumnKey, Row`, and nothing else.
- [ ] Tests: `test/config.test.ts` covers each createAdmin rule with one passing and one failing input (error message contains `drizzle-admin:` and the option name): db, dialect, secret shorter than 32, basePath (`/admin/` → prefix `/admin`, `/` → `""`, rejects `admin`, `/a?b`, `/a#b`, `/a\b`, `/a b`, `//a`), auth with neither function, sessionMaxAgeSec (0, 1.5, default 28800), timeZone invalid, siteTitle default.
- [ ] Tests: `test/config.test.ts` covers `publicOrigin`: `https://a.example`, `https://a.example/`, `http://localhost:3000` are accepted and normalized to the origin (`https://a.example:443` → `https://a.example`); a non-URL string, `ftp://a.example`, `https://a.example/path`, `https://a.example?x`, `https://a.example#x`, `https://u:p@a.example` are rejected; absent → `null`; and `authMode` is `"external"` when both `getUser` and `verifyCredentials` are set. To read normalized values, test through an internal accessor exported from `src/admin.ts` (not from `src/index.ts`).
- [ ] Tests: `test/types.test.ts` has `@ts-expect-error` cases for a nonexistent key in `listDisplay`, in `ordering` as `-nope`, in `widgets` and in `formatters`, plus a fully valid options object that compiles; `pnpm typecheck` passes (so every `@ts-expect-error` is used).
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (sections "Exports of src/index.ts", "Public types", "createAdmin", "Data formats")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md (`resolveTimeZone`, `messages.defaultSiteTitle`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (rows "admin", "admin (types)")
- Decisions: docs/orchestraude/decisions/015-hookctx-definition.md, 017-public-origin.md, 012-db-config-typing.md, 013-unspecified-page-behaviors.md (item 8)

## History
