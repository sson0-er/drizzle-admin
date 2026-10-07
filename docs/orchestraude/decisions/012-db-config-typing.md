# 012: Keep `AdminConfig.db` and action `ctx.db` typed as `unknown`

- Date: 2026-10-07
- Status: accepted

## Context
§5.2 types `db: unknown`. Research noted that typing `db` across drivers is a design matter.

## Decision
Keep `unknown` exactly as in §5.2. Inside `src/data/` the value is cast once to a minimal structural query-builder type, with a reasoned `biome-ignore` for `any` (decision 004).

## Alternatives considered
- `createAdmin<TDb>()` generic carried into `ModelAdminOptions<T, TDb>` so that `run({ db })` is typed: a public API deviation from §5 with more generic noise; not requested.
- A union of concrete driver types: excludes drivers such as libsql, node-postgres and postgres-js.

## Rationale
No deviation from §5 is needed. Drizzle's SQLite and PG builders share the select/insert/update/delete/returning shape used here (evidence: 2026-10-07-drizzle-driver-runtime-behavior).

## Consequences
- Action authors cast `db` themselves (README shows how).
