# drizzle-admin

## What it is

drizzle-admin is a Django Admin-style CRUD admin for [Drizzle ORM](https://orm.drizzle.team) tables. You register your Drizzle tables, mount the result in a [Hono](https://hono.dev) app, and get server-rendered pages. There is no frontend build and no client-side framework.

- List pages with search, filters, sortable columns and pagination.
- Add, change and delete pages generated from the table definition (text, number, checkbox, date, datetime, JSON, enum and foreign-key inputs).
- Bulk delete and your own bulk actions, with an optional confirmation page.
- Per-model permissions (`view`, `add`, `change`, `delete`) evaluated for the current user.
- Hooks and a `validate` callback around saving and deleting.
- Built-in login with a signed session cookie, or your own authentication through `getUser`.
- CSRF protection (Origin check plus a per-session token), security headers and flash messages.
- SQLite and PostgreSQL.
- The user interface text is Japanese only.

## Requirements

- Node.js 24 (the version the test suite runs on). The library source uses only Web-standard APIs and no `node:` modules, but it is only tested on Node.
- `drizzle-orm` `^0.45.3` (peer dependency). Other drizzle-orm versions are not supported.
- A SQLite database (for example `better-sqlite3`) or a PostgreSQL database (for example `pglite`, `node-postgres`, `postgres-js`). The test suite covers `better-sqlite3` and PGlite only.
- A Hono application to mount the admin in (Hono is a dependency of this package), or any server that can call `admin.fetch`.

## Install

```sh
pnpm add drizzle-admin drizzle-orm
```

## Quick start

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createAdmin } from "drizzle-admin";

const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text().notNull(),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
});

const db = drizzle(new Database("app.sqlite"));

const admin = createAdmin({
  db,
  dialect: "sqlite",
  basePath: "/admin",
  secret: process.env.ADMIN_SECRET!, // at least 32 characters
  auth: {
    // Demo only: a plain string comparison. A real deployment should verify a stored hash
    // (bcrypt, argon2 or scrypt) or at least compare in constant time. The login has no rate limiting.
    verifyCredentials: async (username, password) =>
      username === "admin" && password === process.env.ADMIN_PASSWORD
        ? { id: "admin", name: "admin" }
        : null,
  },
});

admin.register(users, {
  listDisplay: ["id", "email", "isActive"],
  searchFields: ["email", "name"],
  listFilter: ["isActive"],
  ordering: ["-id"],
  toString: (row) => row.email,
});

const app = new Hono();
// Mount at exactly the configured basePath.
app.route("/admin", admin.app);

serve({ fetch: app.fetch, port: 3000 });
```

(`@hono/node-server` is only used here to serve the example; install it separately if you want it.)

- Call `register()` for every table before the first access of `admin.app` or `admin.fetch`. The first access finalizes the registry (foreign-key links and cross-model checks are resolved) and builds the app once. Calling `register()` afterwards throws.
- Mount `admin.app` at exactly `basePath`. Its routes are relative, so `app.route("/admin", admin.app)` serves `/admin/`, `/admin/users/` and so on.
- `admin.fetch(request)` is an alternative for servers that are not built on Hono. It accepts a request with a full URL and expects it to be under `basePath`. Requests outside `basePath` are not admin pages and get Hono's default 404.
- Configuration and registration errors are thrown synchronously as `Error` with the message prefix `drizzle-admin: `.

## Configuration reference

### `createAdmin(config: AdminConfig)`

| Field | Type | Default | Constraints |
|---|---|---|---|
| `db` | `unknown` | required | A non-null object: the Drizzle database instance (`drizzle(...)`). It is passed to hooks and actions as given. |
| `dialect` | `"sqlite" \| "postgres"` | required | Must match the dialect of the registered tables, otherwise `register()` throws. |
| `basePath` | `string` | required | Must start with `/` and must not contain `?`, `#`, `\`, whitespace or `//`. A trailing `/` is removed, and `"/"` mounts the admin at the root. |
| `siteTitle` | `string` | `"サイト管理"` | Shown in the header and the page titles. |
| `secret` | `string` | required | At least 32 characters. Signs the session and flash cookies; changing it signs every user out. |
| `auth` | `AuthConfig` | required | At least one of `verifyCredentials` and `getUser` must be a function. See below. |
| `sessionMaxAgeSec` | `number` | `28800` (8 hours) | A positive integer. The expiry is fixed from the time the session was issued (no sliding renewal). |
| `timeZone` | `string` | the server's local time zone | A valid IANA zone name such as `"Asia/Tokyo"`. Used to display and parse datetimes and to decide what "today" means for the date filters. |
| `publicOrigin` | `string` | not set (the origin is derived from each request URL) | See "Deploying behind a reverse proxy". A `http:` or `https:` origin with no credentials, path, query or fragment; stored normalized (`"https://admin.example.com/"` becomes `"https://admin.example.com"`). |

### `AuthConfig`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `verifyCredentials` | `(username, password) => Promise<AdminUser \| null>` | not set | Built-in login: return the user, or `null` to reject the credentials. |
| `getUser` | `(req: Request) => Promise<AdminUser \| null>` | not set | External authentication: called on every page request; return the current user or `null` when nobody is logged in. When set, it wins over `verifyCredentials` and the built-in login page is not used. |
| `loginUrl` | `string` | not set | External mode only: unauthenticated requests are redirected here (see "Authentication modes"). |

`AdminUser` is `{ id: string; name: string }`.

## Model options reference

### `admin.register(table, options?)`

`register()` takes a Drizzle table and optional `ModelAdminOptions`. Every option that names columns takes the property keys of the table's select type, checked by TypeScript (a misspelled column is a compile error) and again at registration (a misspelled column throws). Tables need a single-column primary key.

| Option | Default | Meaning and constraints |
|---|---|---|
| `slug` | the table name | URL segment of the model. Letters, digits, `_` and `-` only; must be unique; `login`, `logout` and `static` are reserved. |
| `label` | the table name | Name shown in the dashboard, breadcrumbs and page titles. |
| `listDisplay` | the primary key followed by the first four other columns, in definition order | Columns shown in the list table. Only these columns can be sorted by clicking the header. |
| `listDisplayLinks` | the first `listDisplay` column | Columns whose cell links to the change page. A foreign-key cell that is not one of these links to the referenced row (when the referenced table is registered) and shows its `toString` label. |
| `searchFields` | none (no search box) | Columns searched by the `q` box. Must be string or enum columns. See "Behavior notes". |
| `listFilter` | none | Columns offered as filters. Must be boolean, enum, date, PostgreSQL `date()` (string mode) or foreign-key columns. A foreign-key filter needs the referenced table to be registered and referenced by its primary key. |
| `ordering` | primary key descending | Default sort: column keys, with a leading `-` for descending (`["-createdAt", "name"]`). The primary key is appended ascending as a tiebreaker unless it is already listed. |
| `listPerPage` | `50` | A positive integer. |
| `fields` | all columns in definition order | Columns shown on the add and change forms, in this order. Cannot be combined with `fieldsets`. |
| `exclude` | none | Columns removed from the form (also applied to `fieldsets`). |
| `readonlyFields` | none | Columns shown as text on the change page and omitted from the add page. Generated columns, columns of unsupported types and (on the change page) primary keys are always display-only. |
| `fieldsets` | one untitled group with the `fields` columns | Groups of columns: `{ title?: string; fields: [...] }[]`. Cannot be combined with `fields`. |
| `widgets` | derived from the column (see below) | Overrides the input element per column. Restricted to the allowed widgets of the column. |
| `formatters` | none | Per-column `(value, row) => string` that replaces the text of a cell in the **list table** (the returned string is escaped). It does not affect the forms. On a foreign-key column the formatter's output replaces the referenced row's label, and the cell no longer links to the referenced row. |
| `toString` | `` `${label} #${pk}` `` | `(row) => string`. Names a row in links, confirmation pages, flash messages and foreign-key choices. |
| `validate` | none | `(data, { mode }) => Record<string, string> \| void` (or a promise). See below. |
| `hooks` | none | `beforeSave`, `afterSave`, `beforeDelete`. See below. |
| `permissions` | all allowed | `view`, `add`, `change` and `delete`, each a boolean or a `(user) => boolean`. An unset entry allows the operation. |
| `actions` | none | Custom bulk actions. See "Actions". |

`register()` also rejects duplicate or empty action names, the reserved action name `delete_selected`, and a widget override that is not allowed for the column:
`drizzle-admin: <table>: widget "<w>" is not allowed for field "<key>" (kind <kind>)`.

`register()` also rejects the `password` widget on the primary key and on a field that is in `searchFields` or `ordering` (in either direction):
`drizzle-admin: <table>: the primary key "<key>" cannot use the password widget`,
`drizzle-admin: <table>: field "<key>" uses the password widget and cannot be in searchFields` and
`drizzle-admin: <table>: field "<key>" uses the password widget and cannot be in ordering`.

### Widgets

The widget only chooses the HTML element. How a submitted value is parsed and validated depends on the column alone, never on the widget. The default widget is derived from the column; `widgets` may replace it with one of the allowed widgets below (the first matching row applies).

| Column | Default widget | Allowed widgets |
|---|---|---|
| has a foreign key | `select` when the referenced table is registered (a number or text input plus a link to the referenced list when it has more than 200 rows); otherwise the input of the column's own type | `select`, `hidden`, plus `number` for number/bigint columns or `text` otherwise |
| enum | `select` | `select`, `text`, `hidden` |
| boolean | `checkbox` | `checkbox` |
| string, PostgreSQL `date()` in string mode | `date` | `date`, `text`, `hidden` |
| string | `textarea` for PostgreSQL `text()`, otherwise `text` | `text`, `textarea`, `password`, `hidden` |
| number, bigint | `number` | `number`, `text`, `hidden` |
| date, PostgreSQL `date()` in date mode | `date` | `date`, `text`, `hidden` |
| date and timestamp | `datetime` | `datetime`, `text`, `hidden` |
| json | `json` | `json`, `textarea` |
| other (unsupported) types | none: never editable | none |

A `select` override on a foreign-key column needs the referenced table to be registered and referenced by its primary key, otherwise finalization throws. If the referenced table has more than 200 rows, the `select` falls back to an input plus a link to the referenced list. The `password` widget is an `<input type="password">` that always renders empty, so the stored value is never written into the HTML. Leaving it empty on the change page keeps the stored value, which means a nullable password field cannot be cleared through the form. Read-only fields and list cells show `********`. The widget adds no hashing: whatever is submitted is stored as given.

### Date and time columns

- Timestamp columns are displayed and edited in `timeZone`.
- Date-only columns (PostgreSQL `date()` in either mode) are calendar dates and are never shifted by `timeZone`; `timeZone` only decides which day "today" is for the filters.
- PostgreSQL `date()` in string mode keeps its values as `YYYY-MM-DD` strings end to end. It gets the date input, strict `YYYY-MM-DD` validation and the date filters.

### Validation and hooks

On a form submission the order is: parse the input, `validate`, `beforeSave`, write, `afterSave`.

- `validate(data, { mode })` receives the parsed values of the editable fields and `mode` is `"add"` or `"change"`. Return an object of column key to message to show errors (a key that is not an editable field becomes a form-level error), or return nothing to accept. A `validate` that throws is a bug and results in a 500 page.
- `hooks.beforeSave(data, ctx)` returns the data to write (return `data` itself for no change). Throwing aborts the save with a generic form error.
- `hooks.afterSave(row, ctx)` runs after a successful write. Throwing does not undo the save: the user gets the success redirect plus a warning message.
- `hooks.beforeDelete(row, ctx)` runs before each delete, including bulk delete. Throwing aborts the delete with a generic error message.
- The messages of exceptions thrown by hooks and actions are never rendered, because they may leak internals. Use `validate` for messages meant for users.

The hook context is:

```ts
interface HookCtx {
  mode: "add" | "change" | "delete"; // "delete" only for beforeDelete
  user: AdminUser;                   // the current user
  db: unknown;                       // AdminConfig.db as given
}
```

## Actions

The list page has an action dropdown for the rows selected with the checkboxes.

- `delete_selected` is built in. It always shows a confirmation page first and requires the `delete` permission.
- Custom actions are listed in `actions`:

  ```ts
  interface AdminAction {
    name: string;                 // unique within the model, not "delete_selected"
    label: string;                // text in the dropdown
    confirm?: boolean;            // show a confirmation page first (default: false)
    run: (ctx: { ids: string[]; db: unknown; user: AdminUser }) => Promise<{ message?: string } | void>;
  }
  ```

- Custom actions require the model's **`change`** permission, both to be offered in the dropdown and to run (otherwise 403). `view` is not enough.
- `ids` are the raw `_selected` strings sent by the client. They are untrusted: they may name rows that do not exist, may not parse as keys (for example `Number("abc")` is `NaN`), and may be any number of values. `run` must parse and validate them and scope its queries itself (the example below only converts them and is not a model of validation).
- `db` is `AdminConfig.db` as given and is typed `unknown`, so cast it to your Drizzle database type:

  ```ts
  actions: [
    {
      name: "deactivate",
      label: "Deactivate selected users",
      confirm: true,
      run: async ({ ids, db }) => {
        const d = db as BetterSQLite3Database;
        d.update(users).set({ isActive: false }).where(inArray(users.id, ids.map(Number))).run();
        return { message: `${ids.length} user(s) deactivated` };
      },
    },
  ],
  ```

- The returned `message` is shown as a success message (default: a generic done message). A thrown error shows a generic error message and the error text is not rendered. After running, the user returns to the list with the same search, filter, sort and page.
- Submitting without selecting any row shows a warning.

## Authentication modes and security

### Authentication modes

**Built-in login** (`verifyCredentials`). The login page is at `<basePath>/login/`; unauthenticated requests are redirected there (302) with a `next` parameter, and after a successful login the user is redirected to `next`. A failed login re-renders the form with status 400. `POST <basePath>/logout/` (the header button) deletes the session cookie in the browser; it does not revoke the session (see "Known limitations"). A successful login always issues a fresh session and CSRF token.

**External authentication** (`getUser`). Your function is called on every page request (not for the stylesheet) and is the only source of the user, so the admin has no login or logout route of its own and no logout button is shown. For a logged-in user, `GET` `/login/` and `/logout/` return 404, and a POST to them without a valid `_csrf` token gets 403 first, like every POST. When nobody is logged in, every page request, including `/login/` and `/logout/`, is redirected (302) to `loginUrl` with `next=<current path and query>` appended (with `?`, or `&` if `loginUrl` already has a query). Without `loginUrl` the response is a 401 page. If both `getUser` and `verifyCredentials` are set, `getUser` wins.

**`next` handling.** Only same-site targets inside `basePath` are followed; anything else falls back to the dashboard. A target is rejected when it is empty, does not start with a single `/`, contains `\`, control characters, whitespace or `//` in its path, has a malformed percent escape, contains a `.` or `..` path segment after percent-decoding, or leaves `basePath`. Percent-encoded characters that belong in a path (for example `%20` in a text primary key) are accepted and stay encoded.

### Cookies

| Cookie | Content | Lifetime |
|---|---|---|
| `da_session` | Signed (HMAC-SHA256 with `secret`): the user, a CSRF token and the issue time | `sessionMaxAgeSec`, fixed |
| `da_flash` | Signed: flash messages shown once after a redirect | 60 seconds |

Both cookies are `HttpOnly`, `SameSite=Lax` and scoped to `basePath`. They are `Secure` when the request URL (or `publicOrigin`, when set) is `https:`. In external mode the session cookie carries only the CSRF token and issue time (no user); the token is bound to the cookie and expires with `sessionMaxAgeSec`.

### CSRF and headers

- Unsafe-method requests (not GET, HEAD or OPTIONS) with a form-like content type (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, or none) pass through an Origin check (Hono's `csrf` middleware): the request passes if the browser sends `Sec-Fetch-Site: same-origin` or the `Origin` header equals the request URL's origin (or `publicOrigin`, when set). Otherwise it gets a 403 page. GET and HEAD requests and other content types skip this check.
- Every POST, whatever its content type, must carry the `_csrf` form field equal to the session's token (compared in constant time); otherwise 403. The admin's own forms include it as a hidden field.
- Responses carry `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` and `Cache-Control: no-store` (the stylesheet is cached instead).
- All output is escaped by Hono's JSX; the library does not use raw HTML insertion.
- Database errors are shown as fixed messages (duplicate value, related data exists, missing required value, other). The raw error message, which may contain SQL and parameters, is never rendered.
- The login endpoint has no rate limiting (see "Known limitations").

### Permissions

`permissions` are evaluated per request with the current user:

- `view`: dashboard entry, list page and the change page (read-only without `change`).
- `add`: the add page and the add button.
- `change`: saving on the change page, and custom actions.
- `delete`: the delete page, the delete button and `delete_selected`.

Foreign keys need `view` on the referenced model too. Without it, the foreign-key columns of the list show the raw values without links or labels, the foreign-key filter is not offered, and the foreign-key fields of the forms are plain key inputs instead of a select.

A change page opened with `view` but without `change` shows every field read-only without save buttons, and a POST to it returns 403. Denied pages return a 403 page.

### Deploying behind a reverse proxy

When TLS is terminated by a reverse proxy, or the application sees an internal host name, the request URL the application sees (for example `http://app:3000`) differs from the origin the browser uses. Set `publicOrigin` to the browser-facing origin:

```ts
createAdmin({
  // ...
  publicOrigin: "https://admin.example.com",
});
```

`publicOrigin` is used for two things: the Origin check compares the request's `Origin` header with it (instead of the request URL's origin), and the session and flash cookies get the `Secure` flag when it starts with `https:`.

Without it, behind such a proxy, form POSTs from browsers that do not send `Sec-Fetch-Site: same-origin` fail with 403, and the cookies lack `Secure`. The library does not trust `X-Forwarded-*` headers. With `publicOrigin` set, only an exactly matching `Origin` (scheme, host and port) or `Sec-Fetch-Site: same-origin` passes, so a form-like POST (see "CSRF and headers") to the internal URL from a client that sends neither header, or a different `Origin`, gets 403. POSTs with another content type skip the Origin check, but every POST still needs the `_csrf` token.

The admin reads each form body fully into memory and has no body size limit of its own. Limit the request body size at the proxy (for example `client_max_body_size` in nginx) or in the host application.

## Behavior notes

- **List page.** Query parameters: `q` (search), `p` (page, 1-based), `o` (ordering) and `f_<column>` (filters). Changing the search, a filter or the ordering resets the page. A page number that is not an integer or is below 1 is page 1; a page beyond the last shows an empty table with the pagination.
- **Search.** The whole trimmed `q` is one term, matched as a case-insensitive substring in any of the `searchFields` (`ILIKE` on PostgreSQL, `LIKE` on SQLite, with `%`, `_` and `\` escaped). On PostgreSQL every search column is cast to text, so uuid, numeric and enum columns can be searched. SQLite's `LIKE` rules for case folding apply.
- **Filters.** Boolean columns offer yes/no, enum columns their values, date columns the presets today, past 7 days, this month and this year (computed in `timeZone`), and foreign-key columns the first 200 referenced rows in the referenced model's `ordering` (primary key descending when it is not set).
- **Sorting.** Clicking a column header cycles that column through ascending, descending and unsorted, and drops other sort keys. A hand-written multi-column `o` is honored. Only `listDisplay` columns can be sorted, and a `password` column cannot (see below).
- **Primary keys.** An auto-increment key is omitted on the add page. Other primary keys can be entered when adding and are display-only when changing (a key cannot be renamed).
- **Saving.** After a successful save the user is redirected (303) to the list, or to the change page with "save and continue", or to the add page with "save and add another", with a flash message. A failed validation re-renders the form with status 400 and the entered values.
- **Deleting.** The delete page and the bulk-delete confirmation ask first. A foreign-key violation is shown as an error message on the list.
- **Missing trailing slash.** A path such as `/admin/users` is redirected (301) to `/admin/users/`. Unknown pages render the admin 404 page.
- **Foreign keys.** Choices are loaded from the referenced model when it is registered and referenced by its primary key; with more than 200 rows the form falls back to a plain input plus a link to the referenced list. Without the `view` permission on the referenced model, the list shows raw values, the filter is not offered and the form field is a plain key input.
- **Password widget.** The `password` widget never renders the stored value. An empty submission on the change page keeps the stored value; read-only fields and list cells show `********`. A `password` list column cannot be sorted: its header has no sort link and `o` ignores it. No hashing is added.

## Known limitations

- Logout does not revoke the session. The session is stateless, so a copied `da_session` cookie stays valid until `sessionMaxAgeSec` passes. Changing `secret` invalidates all sessions.
- No request body size limit inside the library; set one at the reverse proxy or in the host application.
- No login rate limiting: the built-in login does not throttle or lock out repeated attempts. Put a rate limit in front of it (for example in the reverse proxy) or use external authentication.
- Composite primary keys are not supported; registering such a table throws. A table without a primary key throws as well.
- No MySQL; only SQLite and PostgreSQL.
- No file uploads.
- No inlines and no change history.
- The user interface is Japanese only.
- On SQLite, a foreign-key violation is only reported as an error if foreign key enforcement is on (`PRAGMA foreign_keys = ON`). better-sqlite3 enables it by default.
- On SQLite, a bigint column is `blob({ mode: "bigint" })` (drizzle's SQLite `integer()` has no bigint mode). SQLite compares such values as BLOBs, so sorting and range comparison on them are not numeric (for example 10 sorts before 9). Equality and foreign-key lookups work. Use `integer()` when numeric order matters.
- A request path containing a percent-encoded line feed or carriage return (`%0a`, `%0d`) is not routed by Hono, so it gets Hono's (or the host application's) plain 404 instead of the admin 404 page, and without the admin's security headers. No redirect is issued.
- Only drizzle-orm 0.45 is supported.

## Development

Requirements: [mise](https://mise.jdx.dev), which provides the Node.js and pnpm versions pinned in `mise.toml`.

```sh
mise install          # node 24.21.0 and pnpm 12.10.0 from mise.toml
pnpm install
pnpm test             # vitest run
pnpm typecheck        # tsc --noEmit over src, test and example
pnpm lint             # biome check
pnpm build            # tsc to dist/
pnpm example          # then open http://127.0.0.1:3000/admin/ and log in as admin / admin
HOST=0.0.0.0 pnpm example   # listen on all interfaces (set ADMIN_PASSWORD first)
```

`scripts/verify.sh` runs test, typecheck, lint and build in order.

The example app (`example/`) is a demo with users, posts and tags on an in-memory SQLite database seeded with sample data. It listens on `127.0.0.1:3000` unless `HOST` or `PORT` are set. Open `http://127.0.0.1:3000/admin/` and log in as `admin` / `admin`. The environment variables `HOST` (default `127.0.0.1`; an empty value also falls back to `127.0.0.1`), `PORT` (default `3000`), `ADMIN_PASSWORD` (default `admin`; a warning is printed when it is not set) and `ADMIN_SECRET` (default: random at startup, so sessions do not survive a restart) configure it.

## License

MIT. See [LICENSE](LICENSE).
