# Interface: data

Files: `src/data/repository.ts`, `src/data/query.ts`, `src/data/errors.ts`, `src/data/db.ts`.
Uses `ModelMeta` / `FieldMeta` from [introspect.md](introspect.md) and `datePresetRange` / `calendarPresetRange` / `toDateOnly` from [support.md](support.md).
All SQL is built with the Drizzle query builder or the `sql` template with bound parameters. `sql.raw` is never used.

## Responsibilities
- Read and write rows of a registered table, dialect-aware.
- Build search, filter, ordering and pagination conditions from already-whitelisted parameters.
- Convert URL primary-key strings into typed values.
- Classify DB errors.

## API

### `src/data/db.ts` (Drizzle boundary)
```ts
// The minimal builder surface used here; db arrives as `unknown` (decision 012).
export type QueryDb = { select: ...; insert: ...; update: ...; delete: ... };
export function asQueryDb(db: unknown): QueryDb; // single cast, reasoned biome-ignore for any
```

### `src/data/query.ts` (pure, unit-tested)
Changed 2026-10-07: PG search casts every column to `::text` (decision 018). Date presets on date-only fields use `calendarPresetRange` (decision 019).
Changed 2026-10-07: date presets also apply to date-only strings (PG `date()` string mode), with string bounds (decision 023).

```ts
export function escapeLike(s: string): string;            // "\" -> "\\", "%" -> "\%", "_" -> "\_"
export function buildSearch(meta: ModelMeta, searchFields: string[], q: string | undefined,
                            dialect: Dialect): SQL | undefined;
export function buildFilters(meta: ModelMeta, filters: Record<string, string>,
                             timeZone: string, now: Date): SQL[];
export function buildOrderBy(meta: ModelMeta, ordering: OrderItem[]): SQL[];
export function parsePk(field: FieldMeta, raw: string): string | number | bigint | null;
export function parseFieldValue(field: FieldMeta, raw: string): string | number | bigint | null;
export type OrderItem = { key: string; desc: boolean };
```
Rules:
- `buildSearch`: `q` is trimmed; empty or `searchFields` empty → `undefined`. Pattern = `%${escapeLike(q)}%`. PG → ``or(...searchFields.map(k => ilike(sql`${col}::text`, pattern)))``. The cast is required because uuid, numeric, interval, `date()`, string-mode timestamp and pgEnum columns have no `ilike` operator (SQLSTATE 42883). With the cast, all of them and text work (evidence: 2026-10-07-pg-search-non-text-columns). SQLite → ``or(...searchFields.map(k => sql`${col} like ${pattern} escape '\'`))``. Columns come from `meta.table[key]` (decision 009). SQLite has no default LIKE escape character, and PG uses backslash (evidence: 2026-10-07-drizzle-driver-runtime-behavior). SQLite LIKE needs no cast; it matched a numeric column (evidence: 2026-10-07-pg-search-non-text-columns).
- `buildFilters`: called only with keys from `listFilter` (routes whitelist them). Per field:
  - boolean: `"1"` → `eq(col, true)`, `"0"` → `eq(col, false)`, else ignored.
  - enum: value in `enumValues` → `eq(col, value)`, else ignored.
  - FK: `parseFieldValue(field, value)`; non-null → `eq(col, v)`, else ignored.
  - date (kind date, or `isDateOnly` of either kind): `today | past7 | month | year` → `and(gte(col, start), lt(col, end))`, else ignored. Bounds by field:
    - kind date + `isDateOnly` (PgDate): `calendarPresetRange(preset, now, timeZone)` as is (UTC-midnight Dates; drizzle binds them as `YYYY-MM-DDT00:00:00.000Z`, which PG reads as that date; evidence: 2026-10-07-drizzle-pg-date-mapping).
    - kind string + `isDateOnly` (PgDateString): the same `calendarPresetRange` result converted with `toDateOnly(start)` / `toDateOnly(end)` to `YYYY-MM-DD` strings, which drizzle binds unchanged (e.g. `"due" >= '2026-10-07' and "due" < '2026-10-08'`; evidence: 2026-10-07-pg-date-string-mode-filtering). The column value itself is never converted (decision 023).
    - other kind date (timestamps): `datePresetRange(preset, now, timeZone)`.
    The date branch is checked before the FK branch, matching admin.md finalization (a date-kind or date-only FK filters by presets).
  - Invalid values are silently ignored (the page shows "all").
- `buildOrderBy`: `desc(col)` / `asc(col)` per item, then `asc(pk)` appended if the PK is not present. Keys are already whitelisted by routes.
- `parsePk` / `parseFieldValue` by `field.kind`: number → `/^-?\d+$/` and `Number.isSafeInteger` for integer fields (`/^-?\d+(\.\d+)?$/` otherwise) → number; bigint → `/^-?\d+$/` → `BigInt`; string/enum → raw; anything else → `null`.

### `src/data/repository.ts`
```ts
export interface ListParams {
  q?: string; searchFields: string[]; filters: Record<string, string>;
  ordering: OrderItem[]; page: number; perPage: number;   // page is 1-based
}
export type DbRow = Record<string, unknown>;
export interface Repository {
  list(meta: ModelMeta, p: ListParams): Promise<{ rows: DbRow[]; total: number }>;
  get(meta: ModelMeta, pk: string): Promise<DbRow | null>;
  getMany(meta: ModelMeta, pks: readonly string[]): Promise<DbRow[]>;
  create(meta: ModelMeta, data: Record<string, unknown>): Promise<DbRow>;
  update(meta: ModelMeta, pk: string, data: Record<string, unknown>): Promise<DbRow | null>;
  delete(meta: ModelMeta, pks: readonly string[]): Promise<number>;
  options(meta: ModelMeta, opts: { limit: number; ordering: OrderItem[];
                                   toLabel: (row: DbRow) => string }): Promise<{ value: string; label: string }[]>;
}
export function createRepository(cfg: { db: unknown; dialect: Dialect; timeZone: string;
                                        now?: () => Date }): Repository;
```
Behavior:
- `list`: `where = and(buildSearch(...), ...buildFilters(...))`. `total` = `select({ count: count() }).from(table).where(where)` → `Number(count)`. Rows = `select().from(table).where(where).orderBy(...buildOrderBy(...)).limit(perPage).offset((page-1)*perPage)`. Exactly 2 queries.
- `get`: `parsePk`; `null` → return `null` without querying; else `select().from(table).where(eq(pk, v)).limit(1)` → first row or `null`.
- `getMany`: parse every pk and drop invalid ones; dedupe; empty → `[]` with no query; else one `inArray(pk, values)` query. Row order is unspecified.
- `create`: `insert(table).values(data).returning()` → `[0]`.
- `update`: `parsePk` null → `null`; `update(table).set(data).where(eq(pk, v)).returning()` → `[0] ?? null`. When `data` is empty, return `get()` instead (Drizzle rejects an empty `set`; unverified).
- `delete`: parse/dedupe; empty → 0; `delete(table).where(inArray(pk, values)).returning({ pk: pkCol })` → length.
- `options`: `select().from(table).orderBy(...buildOrderBy(meta, ordering)).limit(limit)` → `{ value: String(row[pk.key]), label: toLabel(row) }`.
- DB errors propagate unchanged; callers classify them.

### `src/data/errors.ts`
```ts
export type DbErrorKind = "unique" | "foreignKey" | "notNull" | "other";
export function classifyDbError(err: unknown): DbErrorKind;
export function describeForLog(err: unknown): string; // "<kind> <name> <code>" only
export function isDbError(err: unknown): boolean;       // decision 022
```
Changed 2026-10-07: `isDbError` added for the 500 log policy (decision 022).

`isDbError` is true when `err` or one of up to 5 `.cause` levels is `instanceof DrizzleQueryError` (imported from `drizzle-orm`) or has a string `code`. `err.name` is not used, because a `DrizzleQueryError` has `name` "Error" (evidence: 2026-10-07-pg-search-non-text-columns).

Walks `err` and up to 5 `.cause` levels, reading `code` (decision 011). better-sqlite3 throws `SqliteError` with `code`; PGlite errors arrive wrapped in `DrizzleQueryError` with the code on `cause` (evidence: 2026-10-07-drizzle-driver-runtime-behavior):
`SQLITE_CONSTRAINT_UNIQUE`, `SQLITE_CONSTRAINT_PRIMARYKEY`, `23505` → unique; `SQLITE_CONSTRAINT_FOREIGNKEY`, `23503` → foreignKey; `SQLITE_CONSTRAINT_NOTNULL`, `23502` → notNull; otherwise other.

## Data formats
Changed 2026-10-07: date-only representation (decision 019). Date-only strings added (decision 023).

- Row values are whatever Drizzle returns (Date for date kinds, boolean for SQLite boolean mode, bigint for bigint mode, parsed JSON for json).
- Date-only (kind date + `isDateOnly`, PG `date({mode:"date"})`) values are Dates at UTC midnight of the calendar date, both read and written. Drizzle reads `YYYY-MM-DD` as UTC midnight and writes with `toISOString()`, so any other offset changes the stored day (evidence: 2026-10-07-drizzle-pg-date-mapping). The repository passes values through unchanged; forms produce UTC-midnight Dates.
- Date-only strings (kind string + `isDateOnly`, PG `date()` string mode) are `YYYY-MM-DD` strings, both read and written; drizzle passes them through unchanged (evidence: 2026-10-07-drizzle-pg-date-mapping). No component converts them to `Date`.
- PK strings in URLs are `String(value)` of the PK value.

## Errors
- Repository methods throw the driver/Drizzle error unchanged on DB failure.
- Invalid PK strings never reach SQL: `get` → `null`, `update` → `null`, `getMany` / `delete` → skipped.
