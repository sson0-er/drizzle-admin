# 015: Definition of HookCtx

- Date: 2026-10-07
- Status: accepted (user answer to design question Q2)

## Context
§5.2 uses `HookCtx` in `hooks.beforeSave` / `afterSave` / `beforeDelete` but never defines it. It is part of the public API, so the definition is a public API addition over §5.

## Decision
```ts
export interface HookCtx { mode: "add" | "change" | "delete"; user: AdminUser; db: unknown }
```
`mode` is `"add"` or `"change"` for `beforeSave` / `afterSave`, and `"delete"` only for `beforeDelete`. `db` is `AdminConfig.db` as given; `user` is the current user.

## Alternatives considered
- Also expose `request: Request`: gives hooks access to headers/IP, but couples hooks to HTTP details. It can be added later as an optional field without breaking compatibility.
- `{ mode, user }` only: hooks that need the database would have to capture `db` from module scope, unlike actions.

## Rationale
The shape mirrors the action context `{ ids, db, user }` of §5.2, so users see one consistent context style. Keeping it minimal leaves room for compatible additions later. Chosen by the user (2026-10-07). No external facts involved.

## Consequences
- Exported from `src/index.ts` as a type; documented in the README model options reference.
