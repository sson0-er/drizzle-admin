# 028: `buildApp` returns plain `Hono`

- Date: 2026-10-08
- Status: accepted

## Context
routes.md declared `buildApp(state): Hono<{ Variables: AdminVars }>`. `Admin.app` is a public `Hono` (admin.md) and src/admin.ts stores the built app as `Hono`, so the typed return value would leak the internal variables type into the public API or force a cast at the call site.

## Decision
`buildApp(state: AdminState): Hono`. Internally it builds `new Hono<AdminEnv>()` (`AdminEnv = { Variables: AdminVars }`, exported from context.ts) and returns it cast to `Hono`.

## Alternatives considered
- Return `Hono<AdminEnv>` and cast in src/admin.ts: the cast moves to the caller, which should not know about `AdminVars`.
- Type `Admin.app` as `Hono<AdminEnv>`: exposes internal request variables in the public API.

## Rationale
User decision (2026-10-08). Matches the task 14 code (evidence: 2026-10-08-trailing-slash-open-redirect). The variables are only read by the admin's own middleware and handlers.

## Consequences
- Handlers type their context as `AdminContext = Context<AdminEnv>` (context.ts), not via the `buildApp` return type.
