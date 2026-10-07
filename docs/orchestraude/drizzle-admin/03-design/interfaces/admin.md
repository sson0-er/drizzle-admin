# Interface: admin (public API)

Files: `src/index.ts`, `src/types.ts`, `src/admin.ts`.
Related: [introspect.md](introspect.md) (`ModelMeta`), [routes.md](routes.md) (`buildApp`), [support.md](support.md) (`resolveTimeZone`, messages).

## Responsibilities
- Define and export the public types of §5.2 (unchanged except where noted below).
- `createAdmin(config)`: validate and normalize config, return an `Admin`.
- `register(table, options)`: introspect, validate options, resolve defaults into a `ResolvedModel`, store it.
- Finalize the registry lazily on first `admin.app` / `admin.fetch` access, then build the Hono app once.

## API

### Exports of `src/index.ts`
```ts
export { createAdmin } from "./admin.js";
export type {
  Admin, AdminConfig, AuthConfig, AdminUser, ModelAdminOptions, AdminAction,
  WidgetType, HookCtx, ColumnKey, Row,
} from "./types.js";
```
Nothing else is exported (ModelMeta, ResolvedModel and the repository are internal).

### Public types (`src/types.ts`)
Changed 2026-10-07: added `AdminConfig.publicOrigin` (decision 017) and fixed `HookCtx` (decision 015).

These are copied from §5.2 verbatim, except `AdminConfig.publicOrigin` (decision 017) and the `HookCtx` definition (decision 015), which §5.2 lacks. `Table` is `import type { Table } from "drizzle-orm"`.
```ts
export type ColumnKey<T extends Table> = keyof T["$inferSelect"] & string;
export type Row<T extends Table> = T["$inferSelect"];
export interface AdminConfig { db: unknown; dialect: "sqlite" | "postgres"; basePath: string;
  siteTitle?: string; secret: string; auth: AuthConfig; sessionMaxAgeSec?: number; timeZone?: string;
  publicOrigin?: string }   // addition over §5.2 (decision 017), e.g. "https://admin.example.com"
export interface AuthConfig { verifyCredentials?: (username: string, password: string) => Promise<AdminUser | null>;
  getUser?: (req: Request) => Promise<AdminUser | null>; loginUrl?: string }
export interface AdminUser { id: string; name: string }
export type WidgetType = "text" | "textarea" | "number" | "checkbox" | "select"
  | "date" | "datetime" | "json" | "password" | "hidden";
export interface ModelAdminOptions<T extends Table> {
  slug?: string;
  label?: string;
  listDisplay?: ColumnKey<T>[];
  listDisplayLinks?: ColumnKey<T>[];
  searchFields?: ColumnKey<T>[];
  listFilter?: ColumnKey<T>[];
  ordering?: (ColumnKey<T> | `-${ColumnKey<T>}`)[];
  listPerPage?: number;
  fields?: ColumnKey<T>[];
  exclude?: ColumnKey<T>[];
  readonlyFields?: ColumnKey<T>[];
  fieldsets?: { title?: string; fields: ColumnKey<T>[] }[];
  widgets?: Partial<Record<ColumnKey<T>, WidgetType>>;
  formatters?: Partial<Record<ColumnKey<T>, (value: unknown, row: Row<T>) => string>>;
  toString?: (row: Row<T>) => string;
  validate?: (data: Partial<Row<T>>, ctx: { mode: "add" | "change" }) =>
    Promise<Record<string, string> | void> | Record<string, string> | void;
  hooks?: {
    beforeSave?: (data: Partial<Row<T>>, ctx: HookCtx) => Promise<Partial<Row<T>>> | Partial<Row<T>>;
    afterSave?: (row: Row<T>, ctx: HookCtx) => Promise<void> | void;
    beforeDelete?: (row: Row<T>, ctx: HookCtx) => Promise<void> | void;
  };
  permissions?: {
    view?: boolean | ((user: AdminUser) => boolean);
    add?: boolean | ((user: AdminUser) => boolean);
    change?: boolean | ((user: AdminUser) => boolean);
    delete?: boolean | ((user: AdminUser) => boolean);
  };
  actions?: AdminAction<T>[];
}
export interface AdminAction<T extends Table> { name: string; label: string; confirm?: boolean;
  run: (ctx: { ids: string[]; db: unknown; user: AdminUser }) => Promise<{ message?: string } | void> }
```
`AdminAction<T>` keeps the unused `T` parameter for §5.2 compatibility. Biome may flag the unused type parameter; if so, suppress it with a reasoned comment.

`HookCtx` is referenced but not defined by §5.2. Definition (decision 015):
```ts
export interface HookCtx { mode: "add" | "change" | "delete"; user: AdminUser; db: unknown }
```
`mode` is `"add"` / `"change"` for `beforeSave` and `afterSave`, and `"delete"` only for `beforeDelete`. `user` is the current user, `db` is `AdminConfig.db` as given (same style as the action context `{ ids, db, user }`).

`Admin`:
```ts
export interface Admin {
  register<T extends Table>(table: T, options?: ModelAdminOptions<T>): void;
  readonly app: Hono;                          // getter; first access finalizes
  fetch(request: Request): Promise<Response>;  // first call finalizes
}
```
`fetch` is not in §5.2's types; this signature completes §5.1's "Also expose admin.fetch" (decision 006).

### `createAdmin(config: AdminConfig): Admin`
Changed 2026-10-07: added the `publicOrigin` rule (decision 017).

Validation (each failure throws `Error("drizzle-admin: <message>")`):
| Check | Rule |
|---|---|
| db | not `null`/`undefined` and `typeof === "object"` |
| dialect | `"sqlite"` or `"postgres"` |
| secret | string, `length >= 32` |
| basePath | starts with `/`; no `?`, `#`, `\`, whitespace or `//`; trailing `/` removed. The result is `prefix` (`"/"` → `""`) |
| auth | at least one of `verifyCredentials`, `getUser` is a function |
| sessionMaxAgeSec | positive integer if given; default `28800` |
| timeZone | valid IANA zone via `resolveTimeZone` (support.md); default: server local zone |
| siteTitle | default `messages.defaultSiteTitle` |
| publicOrigin | optional. If given: a string containing no `?` or `#` that `new URL()` parses, with protocol `http:` or `https:`, empty username and password, and pathname `/` (no path beyond an optional trailing `/`). Stored normalized as `new URL(v).origin` (e.g. `"https://admin.example.com/"` → `"https://admin.example.com"`, default port dropped). Absent → `null` |

Derived `authMode`: `"external"` if `getUser` is set (it wins over `verifyCredentials`, decision 013 item 8), else `"builtin"`.

### `admin.register(table, options = {})`
Changed 2026-10-07: step 5 checks widget overrides, and finalization checks FK `select` overrides (decision 021).
Changed 2026-10-07: `listFilter` accepts date-only string fields (PG `date()` string mode; decision 023).

Steps, in order:
1. If finalized → throw `register() must be called before admin.app / admin.fetch is used`.
2. `meta = introspectTable(table, dialect)`. This throws for a dialect mismatch, no PK or composite PK (introspect.md).
3. `slug = options.slug ?? meta.tableName`. It must match `/^[A-Za-z0-9_-]+$/`, must not be `login`, `logout` or `static`, and must not be registered already.
4. Column-name checks. Every key below must be a `meta.fields[].key`, otherwise throw `<table>: option "<option>" references unknown column "<key>"`:
   `listDisplay`, `listDisplayLinks`, `searchFields`, `listFilter`, `ordering` (after stripping a leading `-`), `fields`, `exclude`, `readonlyFields`, every `fieldsets[i].fields`, keys of `widgets`, keys of `formatters`.
5. Extra checks (decision 013 item 13): `listFilter` keys must have kind boolean/enum/date, `isDateOnly` (PG `date()` string mode, decision 023) or a `foreignKey`. `searchFields` kinds must be string/enum. `fields` and `fieldsets` must not both be set. Action names must be unique, non-empty and not `delete_selected`. `listPerPage` must be a positive integer. Every `widgets[key]` must be in `allowedWidgets(field)` (forms.md, decision 021), otherwise throw `<table>: widget "<w>" is not allowed for field "<key>" (kind <kind>)`.
6. Build the `ResolvedModel` (below) and store it in insertion order.

### Finalization (internal `finalize()`, idempotent)
Changed 2026-10-07: FK `select` override check added (decision 021).

- For every field with `foreignKey`: if a registered model has `meta.table === foreignKey.table` and `foreignKey.column === thatModel.meta.pk.key`, set `foreignKey.slug = thatModel.slug`.
- For every `listFilter` key that is an FK (kind not boolean/enum/date and not `isDateOnly`; Changed 2026-10-07, decision 023): `foreignKey.slug` must be set, otherwise throw `<table>: listFilter "<key>" needs the referenced table to be registered and referenced by its primary key`.
- For every `widgets[key] === "select"` on an FK field (kind not enum): `foreignKey.slug` must be set, otherwise throw `<table>: widget "select" for "<key>" needs the referenced table to be registered and referenced by its primary key` (decision 021).
- Freeze the registry, then `buildApp(state)` (routes.md) once. `admin.fetch` = `new Hono().route(prefix || "/", app).fetch(request)`.

## Data formats

### `ResolvedModel` (internal, `src/types.ts` or `src/admin.ts`)
```ts
interface ResolvedModel {
  slug: string;
  label: string;                         // options.label ?? meta.tableName
  meta: ModelMeta;
  listDisplay: string[];                 // default: [pk.key, ...first 4 non-pk field keys]
  listDisplayLinks: string[];            // default: [listDisplay[0]]
  searchFields: string[];                // default []
  listFilter: string[];                  // default []
  ordering: { key: string; desc: boolean }[]; // parsed options.ordering, default []
  listPerPage: number;                   // default 50
  fieldsets: { title?: string; fields: string[] }[];
      // options.fieldsets, else [{ fields: (options.fields ?? all keys in definition order) minus exclude }]
      // exclude is also applied to fieldsets
  readonlyFields: ReadonlySet<string>;
  widgets: Readonly<Record<string, WidgetType>>;
  formatters: Readonly<Record<string, (value: unknown, row: Record<string, unknown>) => string>>;
  toString: (row: Record<string, unknown>) => string; // default: `${label} #${String(row[pk.key])}`
  validate?: (data: Record<string, unknown>, ctx: { mode: "add" | "change" }) =>
    Promise<Record<string, string> | void> | Record<string, string> | void;
  hooks: { beforeSave?; afterSave?; beforeDelete? };  // same signatures as §5.2 with Row widened
  permissions: Record<"view" | "add" | "change" | "delete", (user: AdminUser) => boolean>;
      // boolean b → () => b ; undefined → () => true
  actions: AdminAction<Table>[];         // custom actions only; built-in delete is added by routes
}
```

### `AdminState` (passed to `buildApp`)
Changed 2026-10-07: added `config.publicOrigin` (decision 017).
```ts
interface AdminState {
  config: { db: unknown; dialect: Dialect; prefix: string; siteTitle: string; secret: string;
            sessionMaxAgeSec: number; timeZone: string; authMode: "builtin" | "external"; auth: AuthConfig;
            publicOrigin: string | null };   // normalized origin, see createAdmin
  models: ReadonlyMap<string, ResolvedModel>;   // by slug, registration order
  modelByTable: ReadonlyMap<Table, ResolvedModel>;
}
```
`Dialect = "sqlite" | "postgres"`.

## Errors
- All configuration and registration errors are synchronous `Error`s with the `drizzle-admin: ` prefix and the table name (when known), option name and offending key in the message. Tests match on these substrings.
- Type-level: a nonexistent column in any `ColumnKey<T>` option is a compile error (checked by `test/types.test.ts` under `pnpm typecheck`).
