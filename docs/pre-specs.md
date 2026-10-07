# drizzle-admin Implementation Spec

Build a library that provides a Django Admin–style CRUD admin interface, rendered entirely on the server, simply by registering Drizzle ORM table definitions.

This document is a specification for the implementer (Claude Code). Implement in phase order, and make sure each phase's acceptance criteria pass as tests before moving on to the next.

---

## 1. Goals and Principles

- **Backend only**: All pages are rendered as HTML on the server. Do not use frontend frameworks such as React or Vue, and do not introduce a frontend build step. Core functionality must work with JavaScript disabled.
- **Feel like Django Admin**: Calling `register()` on a table produces list, add, change, and delete pages, which can be customized through options such as `listDisplay`.
- **Web-standard based**: Use Hono internally and depend only on `Request` / `Response`. Aim to run on Node, Bun, Deno, and Cloudflare Workers (for v1, verifying on Node only is acceptable).
- **Type-safe**: Field names in options are inferred from the table definition; a nonexistent column name must be a compile error.

## 2. Non-goals (not in v1)

- Tables with composite primary keys (throw an explicit error at registration)
- Django-style inlines (editing child records inside a parent form)
- Change history (equivalent of Django's LogEntry)
- Internationalization (UI strings are Japanese only, but must all live in a single file)
- MySQL support (SQLite and PostgreSQL only)
- File uploads

## 3. Tech Stack

| Purpose | Choice |
|---|---|
| Language | TypeScript (strict) |
| HTTP | Hono |
| HTML generation | Hono JSX (`hono/jsx`), rendered to strings on the server only |
| ORM | drizzle-orm (peerDependency) |
| Validation | zod |
| Testing | vitest |
| Test databases | SQLite: in-memory better-sqlite3; PostgreSQL: PGlite (`drizzle-orm/pglite`) |
| Package manager | pnpm |

**Note**: Drizzle's internal APIs (column metadata) may change between versions. Pin the installed version in `package.json` and confine all dependencies on Drizzle internals to `src/introspect/`. Before implementing, check the installed Drizzle type definitions to confirm the property names on `Column`.

## 4. Directory Layout

```
drizzle-admin/
├── src/
│   ├── index.ts              # Public API (createAdmin, type re-exports)
│   ├── admin.ts              # Admin class: register, assembling the Hono app
│   ├── types.ts              # Public types such as ModelAdminOptions
│   ├── introspect/
│   │   ├── index.ts          # Table → ModelMeta conversion
│   │   ├── sqlite.ts         # Adapts getTableConfig (sqlite-core)
│   │   └── pg.ts             # Adapts getTableConfig (pg-core)
│   ├── data/
│   │   ├── repository.ts     # list / count / get / create / update / delete
│   │   └── query.ts          # Builds search, filter, and ordering conditions
│   ├── forms/
│   │   ├── coerce.ts         # Form strings → typed values
│   │   ├── schema.ts         # ModelMeta → zod schema generation
│   │   └── widgets.tsx       # Field type → input element
│   ├── auth/
│   │   ├── session.ts        # Signed cookie sessions
│   │   ├── csrf.ts
│   │   └── flash.ts          # Flash messages
│   ├── views/
│   │   ├── layout.tsx
│   │   ├── dashboard.tsx
│   │   ├── list.tsx
│   │   ├── form.tsx
│   │   ├── delete.tsx
│   │   └── login.tsx
│   ├── static/admin.css      # Embedded as a string and served from a route
│   └── messages.ts           # UI strings
├── example/                  # Demo app for manual testing
│   ├── schema.ts             # users, posts (author → users), tags
│   ├── seed.ts
│   └── server.ts
└── test/
```

## 5. Public API

### 5.1 Usage example (the goal is for exactly this to work)

```ts
import { Hono } from "hono";
import { createAdmin } from "drizzle-admin";
import { db } from "./db";
import { users, posts } from "./schema";

const admin = createAdmin({
  db,
  dialect: "sqlite",              // "sqlite" | "postgres"
  basePath: "/admin",
  siteTitle: "Admin",
  secret: process.env.ADMIN_SECRET!, // For cookie signing (require at least 32 chars)
  auth: {
    // Called from the built-in login page. Returns user info on success
    verifyCredentials: async (username, password) =>
      username === "admin" && password === process.env.ADMIN_PASSWORD
        ? { id: "admin", name: "Administrator" }
        : null,
  },
});

admin.register(users, {
  label: "Users",
  listDisplay: ["id", "email", "isActive", "createdAt"],
  searchFields: ["email", "name"],
  listFilter: ["isActive"],
  ordering: ["-createdAt"],
  readonlyFields: ["createdAt"],
  toString: (row) => row.email,
  actions: [
    {
      name: "deactivate",
      label: "Deactivate selected users",
      run: async ({ ids, db }) => {
        /* ... */
        return { message: `Deactivated ${ids.length} users` };
      },
    },
  ],
});

admin.register(posts, {
  listDisplay: ["id", "title", "authorId", "publishedAt"],
});

const app = new Hono();
app.route("/admin", admin.app);
// Also expose admin.fetch so it can be used outside Hono
```

### 5.2 Type definitions

```ts
type ColumnKey<T extends Table> = keyof T["$inferSelect"] & string;
type Row<T extends Table> = T["$inferSelect"];

interface AdminConfig {
  db: unknown;                    // Drizzle database instance
  dialect: "sqlite" | "postgres";
  basePath: string;
  siteTitle?: string;
  secret: string;
  auth: AuthConfig;
  sessionMaxAgeSec?: number;      // Default: 8 hours
  timeZone?: string;              // Default: server local time zone
}

interface AuthConfig {
  verifyCredentials?: (username: string, password: string) => Promise<AdminUser | null>;
  // For integrating with an existing auth system. When set, the login page is not used
  getUser?: (req: Request) => Promise<AdminUser | null>;
  loginUrl?: string;              // Redirect target for unauthenticated users when using getUser
}

interface AdminUser { id: string; name: string }

interface ModelAdminOptions<T extends Table> {
  slug?: string;                  // Used in URLs. Default: table name
  label?: string;                 // Default: table name
  listDisplay?: ColumnKey<T>[];   // Default: primary key + roughly the first 4 columns
  listDisplayLinks?: ColumnKey<T>[]; // Default: first entry of listDisplay
  searchFields?: ColumnKey<T>[];  // If omitted, no search box is shown
  listFilter?: ColumnKey<T>[];    // Supports boolean / enum / FK / date
  ordering?: (ColumnKey<T> | `-${ColumnKey<T>}`)[];
  listPerPage?: number;           // Default: 50
  fields?: ColumnKey<T>[];        // Fields shown in forms, and their order
  exclude?: ColumnKey<T>[];
  readonlyFields?: ColumnKey<T>[];
  fieldsets?: { title?: string; fields: ColumnKey<T>[] }[];
  widgets?: Partial<Record<ColumnKey<T>, WidgetType>>;
  formatters?: Partial<Record<ColumnKey<T>, (value: unknown, row: Row<T>) => string>>;
  toString?: (row: Row<T>) => string; // Django's __str__. Default: "<label> #<pk>"
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

interface AdminAction<T extends Table> {
  name: string;
  label: string;
  confirm?: boolean;              // If true, show a confirmation page first
  run: (ctx: { ids: string[]; db: unknown; user: AdminUser }) =>
    Promise<{ message?: string } | void>;
}

type WidgetType = "text" | "textarea" | "number" | "checkbox" | "select"
  | "date" | "datetime" | "json" | "password" | "hidden";
```

At registration time, `register()` validates the following and throws an exception with a descriptive message if anything is wrong: the primary key is a single column, every column name in the options exists, and `slug` is not a duplicate.

## 6. Introspection (`src/introspect`)

Generate the following `ModelMeta` from a table. Everything downstream works only with `ModelMeta` (never touch Drizzle's `Column` directly).

```ts
interface FieldMeta {
  key: string;            // Property name on the TS side
  dbName: string;         // Column name in the database
  kind: "string" | "number" | "bigint" | "boolean" | "date" | "json" | "enum" | "unknown";
  enumValues?: string[];
  notNull: boolean;
  hasDefault: boolean;    // Has a default value or $defaultFn
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  foreignKey?: { table: Table; column: string; slug?: string }; // slug if the referenced table is registered
}

interface ModelMeta {
  table: Table;
  tableName: string;
  pk: FieldMeta;
  fields: FieldMeta[];    // In definition order
}
```

Where to get the information (verify against the installed version's type definitions):

- Columns: `getTableColumns(table)` (from `drizzle-orm`)
- Table name: `getTableName(table)`
- Type: `column.dataType` and `column.columnType`; treat as `enum` if `enumValues` is present
- Required / default / primary key: `column.notNull` / `column.hasDefault` / `column.primary`
- Foreign keys and composite primary keys: `foreignKeys` / `primaryKeys` from `getTableConfig(table)` (`drizzle-orm/sqlite-core` or `drizzle-orm/pg-core`)
- SQLite columns such as `integer({ mode: "boolean" })` and `integer({ mode: "timestamp" })` must be correctly detected as boolean / date using `columnType` and the mode

Types that cannot be determined become `unknown`: stringified in lists, shown read-only in forms.

**Tests**: For both SQLite and PostgreSQL, write snapshot tests of `ModelMeta` against table definitions covering the main types (text, integer, boolean, timestamp, json, enum, FK, serial / autoincrement).

## 7. Data Access (`src/data`)

```ts
interface ListParams {
  q?: string;
  filters: Record<string, string>;
  ordering: { key: string; desc: boolean }[];
  page: number;           // 1-based
  perPage: number;
}

interface Repository {
  list(meta: ModelMeta, p: ListParams): Promise<{ rows: Row[]; total: number }>;
  get(meta: ModelMeta, pk: string): Promise<Row | null>;
  create(meta: ModelMeta, data: Record<string, unknown>): Promise<Row>;
  update(meta: ModelMeta, pk: string, data: Record<string, unknown>): Promise<Row>;
  delete(meta: ModelMeta, pks: string[]): Promise<number>;
  // For FK choices
  options(meta: ModelMeta, opts: { q?: string; limit: number }): Promise<{ value: string; label: string }[]>;
}
```

- Search: combine substring matches on each `searchFields` column with `or()`. Use `ilike` on PostgreSQL and `like` on SQLite. Escape LIKE wildcards (`%`, `_`).
- Filters: query parameters take the form `f_<key>=<value>`. Booleans use `1/0`; dates use presets ("Today", "Past 7 days", "This month", "This year"); FKs and enums use exact match.
- Ordering: query parameter in the form `o=-createdAt,id`. Only columns in `listDisplay` are allowed; ignore anything else. Always append the primary key last to keep ordering stable.
- Count: use `select({ count: count() })`.
- Primary keys are strings in URLs. Convert them back (e.g. to numbers) according to `FieldMeta.kind` before comparing.
- `create` / `update` use `.returning()` on both PostgreSQL and SQLite (both support it).
- Build all SQL with Drizzle's query builder; never pass user input into `sql.raw`.

## 8. Routes and Pages

Define the following under `basePath`. Use trailing slashes like Django (redirect to the slashed URL if missing).

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Dashboard: list of registered models with "Add" and "Change" links |
| GET / POST | `/login/` | Login (only when `verifyCredentials` is used) |
| POST | `/logout/` | Logout |
| GET | `/:model/` | List |
| POST | `/:model/` | Run a bulk action (`action`, multiple `_selected`) |
| GET / POST | `/:model/add/` | Add |
| GET / POST | `/:model/:pk/change/` | Change |
| GET / POST | `/:model/:pk/delete/` | Delete confirmation and deletion |
| GET | `/static/admin.css` | Stylesheet (with long-term caching headers) |

### List page

- Top: search box, action dropdown + run button, "Add" button
- Right side (top on narrow screens): `listFilter` filters. Show the current selection, and switch via links that preserve other query parameters
- Table: selection checkbox in the first column; clicking a column header cycles sorting (ascending → descending → off)
- Value display: booleans as ✓ / ✗, dates in local format, null as "-", FKs link to the referenced record's change page if that model is registered, long strings truncated
- Bottom: pagination and total count
- Always include a built-in "Delete selected records" action (only with delete permission), with a confirmation page

### Add / change pages

- Group by `fieldsets` if provided; otherwise show all fields in one group
- Auto-increment primary keys and `readonlyFields` are display-only (hidden on the add page)
- Three save buttons: "Save", "Save and add another", "Save and continue editing", with the same redirects as Django
- The change page has a "Delete" link

### Delete page

- Show the target record's `toString` and a confirm button
- If deletion fails due to a foreign key constraint, show an error message and return to the list (v1 does not enumerate related objects)

## 9. Form Handling (`src/forms`)

### Default widget mapping

| kind | Widget |
|---|---|
| string | `text` (even if the column name contains `password`; override via `widgets` if needed) |
| string (long text: PG `text` type, or specified via `widgets`) | `textarea` |
| number / bigint | `number` |
| boolean | `checkbox` |
| date | `datetime` (`<input type="datetime-local">`) |
| enum | `select` |
| json | `json` (textarea + JSON parse on submit) |
| FK | `select` (choices come from the referenced model's `options()`; if there are more than 200, fall back to a primary-key input with a link to the referenced model) |

### Coercion rules (`coerce.ts`)

All form values arrive as strings. Convert them according to the following rules; a conversion failure is an error on that field.

- Empty string: `null` if not `notNull`. If `notNull` and `hasDefault` on add, omit the value (let the DB default apply). Otherwise, a "This field is required" error
- number: `Number()` must be finite; integer columns must receive integers
- bigint: convert with `BigInt()`
- boolean: unchecked checkboxes are not submitted, so a field shown in the form with no value is `false`
- date: interpret the `datetime-local` value in the configured time zone (`AdminConfig.timeZone`, default: server local)
- json: `JSON.parse`; on failure, "Invalid JSON"
- enum: must be one of `enumValues`

### Validation flow

1. Accept only fields displayed in the form (discard any other submitted values, to prevent mass assignment)
2. Coerce types
3. Validate with the zod schema generated from `ModelMeta`
4. Run `ModelAdminOptions.validate`
5. `hooks.beforeSave` → write to the DB → `hooks.afterSave`
6. Catch DB errors such as unique constraint violations and show them as form-level errors

On error, re-render with the submitted values preserved and return status 400. On success, redirect with 303 and show a flash message (PRG pattern).

## 10. Authentication and Security

- **Sessions**: signed cookies (HMAC-SHA256 via the Web Crypto API). `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS. Contents are limited to user info, the CSRF token, and the issue time
- **Unauthenticated access**: redirect to the login page (or `loginUrl`) with a `next` parameter. Only allow relative paths under `basePath` for `next` (open redirect protection)
- **CSRF**: embed the session's token as a hidden field in every form and verify it on POST using constant-time comparison. Additionally, verify the Origin with `hono/csrf`
- **XSS**: rely on Hono JSX auto-escaping; do not use `raw` / `dangerouslySetInnerHTML`. Return values from `formatters` are also escaped as strings
- **Permissions**: enforce `permissions` not just by hiding buttons but in the routes themselves, returning 403
- **Login attempts**: v1 does not implement rate limiting, but the README must call this out
- **Response headers**: `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Cache-Control: no-store` (except static files)

## 11. Look and Feel

- A single CSS file, `static/admin.css`. No external fonts or CDNs
- A calm, Django Admin–like color scheme with a header, breadcrumbs, and main content area
- Support `prefers-color-scheme: dark`
- Below 768px width, move filters to the top and make tables scroll horizontally
- Core features require no JavaScript. The only exception: a small inline script for the "select all" checkbox on the list page (everything else must still work with it disabled)

## 12. Testing Strategy

- Focus on integration tests using Hono's `app.request()`. Parameterize them to run the same tests against both in-memory SQLite and PGlite
- Unit tests: introspection, coercion, query-condition building, session signing
- Integration tests: every page's GET returns 200; happy and error paths for add, change, and delete; search, filters, ordering, and pagination; 403 from permissions; 403 when the CSRF token is missing; redirect when not logged in
- For HTML assertions, check for the presence and content of specific elements rather than full-page snapshots (light parsing with `parse5` or similar is fine)

## 13. Implementation Phases

At the end of each phase, `pnpm test` and `pnpm typecheck` must pass.

**Phase 1: Foundation and introspection**
Project setup, skeleton of `createAdmin` / `register`, `ModelMeta` generation, and the schema and seed data in `example/`.
Acceptance criteria: introspection snapshot tests pass on SQLite and PG. `register` throws descriptive exceptions for invalid options.

**Phase 2: List page**
Layout, dashboard, and list page (search, filters, ordering, pagination, value formatting). No authentication yet.
Acceptance criteria: running `example/server.ts` shows the list in a browser. List-related integration tests pass.

**Phase 3: Add and change**
Widgets, coercion, validation, PRG, flash messages, and the three save buttons.
Acceptance criteria: happy-path and error-path add/change tests pass for every column type.

**Phase 4: Delete and actions**
Delete confirmation page, bulk delete, custom actions (with and without confirmation).
Acceptance criteria: tests pass, including showing an error on FK constraint violations.

**Phase 5: Authentication and security**
Login / logout, sessions, CSRF, permissions, security headers, and external auth integration via `getUser`.
Acceptance criteria: every item in Section 10 has a test.

**Phase 6: Polish**
FK select with the 200-item fallback, dark mode, responsive layout, and a README (setup, every option, known limitations).

## 14. Working Agreements

- If something is unclear or the spec contradicts itself, do not silently guess: record it in `NOTES.md`, make a reasonable provisional decision, and note that decision there
- If the public API in Section 5 needs to change, write down the reason in `NOTES.md`
- Restrict `any` to the boundary with Drizzle's internal types (`src/introspect/`, `src/data/`), and add a comment explaining why even there
- Before adding any dependency not listed in Section 3, write down why it is needed in `NOTES.md`

## 15. Possible Future Extensions (not in v1)

- FK autocomplete (partial updates via htmx)
- Inlines
- Change history
- CSV export
- Internationalization
- MySQL support
- Rate limiting for login attempts
