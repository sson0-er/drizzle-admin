# Interface: example app

Changed 2026-10-09 (decision 053): a second example, the OIDC SSO demo under `example/oidc/`, is specified in [example-oidc.md](example-oidc.md); it reuses `createExampleAdmin` and `hostGuard` from here.

Files: `example/schema.ts`, `example/seed.ts`, `example/app.ts`, `example/host-guard.ts`, `example/server.ts` (`app.ts` is an addition to §4 so the smoke test can build the app without listening on a port; `host-guard.ts` is an addition from decision 048 so the Host check can be unit-tested without starting the server). It imports the library from `../src/index.js` (run with tsx; decision 005). It uses SQLite through better-sqlite3 so it runs with no external services.

## Responsibilities
- Demonstrate §5.1 usage, with users, posts (author → users) and tags.
- Give the user a browser check of login, dashboard, list, add, change, delete and actions.

## API

### `example/schema.ts`
```ts
export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text().notNull(),
  role: text({ enum: ["admin", "editor", "viewer"] }).notNull().default("viewer"),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: integer({ mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
export const posts = sqliteTable("posts", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  body: text(),
  status: text({ enum: ["draft", "published"] }).notNull().default("draft"),
  authorId: integer().notNull().references(() => users.id),
  publishedAt: integer({ mode: "timestamp" }),
  metadata: text({ mode: "json" }),
});
export const tags = sqliteTable("tags", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});
```
### `example/seed.ts`
```ts
export function createSchema(sqlite: Database.Database): void; // constant CREATE TABLE DDL matching schema.ts, via sqlite.exec
export async function seed(db: BetterSQLite3Database): Promise<void>;
```
Seed data: 5 users (one inactive, mixed roles), 60 posts spread across authors, statuses and dates (some within today / past 7 days / this month, so that pagination and filters show), 8 tags. The data is deterministic (no randomness).

### `example/app.ts`
Changed 2026-10-09 (decision 053): the DB setup, seed, `createAdmin` call and registrations move into `createExampleAdmin`, so the OIDC example (example-oidc.md) builds the same admin with external auth. `createExampleApp` keeps its signature and behavior; existing tests are unchanged.
```ts
export async function createExampleApp(opts: { secret: string; adminPassword: string }): Promise<{ app: Hono; admin: Admin }>;
export async function createExampleAdmin(opts: { secret: string; auth: AuthConfig }): Promise<Admin>;
```
Everything below except the port and environment handling lives here; `server.ts` reads the environment, calls it and serves. `createExampleAdmin` does the in-memory DB, seed, `createAdmin({ ..., secret, auth })` and the three registrations, and returns the admin without reading `admin.app`. `createExampleApp` calls it with `auth: { verifyCredentials }` (below), then builds the `Hono` app (`GET /` redirect and the mount).

### `example/server.ts` (behavior of app.ts + server.ts together)
Changed 2026-10-08: the server binds to `127.0.0.1` by default, overridable with `HOST` (decision 038).
Changed 2026-10-08: `hostname = process.env.HOST || "127.0.0.1"`, so an empty `HOST` also falls back to `127.0.0.1` (task 36, decision 038 item 2).

- `new Database(":memory:")`, `PRAGMA foreign_keys = ON`, `createSchema`, `drizzle(sqlite)`, `await seed(db)`.
- `createAdmin({ db, dialect: "sqlite", basePath: "/admin", siteTitle: "drizzle-admin demo", secret, auth: { verifyCredentials } })`
  - `secret = process.env.ADMIN_SECRET ?? <random 32-byte hex generated at startup>`; sessions do not survive a restart unless it is set.
  - `verifyCredentials`: username `admin`, password `process.env.ADMIN_PASSWORD ?? "admin"`. Prints a warning at startup when the default password is in use.
- Registrations:
  - users: the §5.1 options (listDisplay id/email/isActive/createdAt, searchFields email/name, listFilter isActive and role, ordering `-createdAt`, readonlyFields createdAt, toString email). Action `deactivate` sets `isActive = false` for the ids and has `confirm: true`. Action `activate` does the opposite without confirmation.
  - posts: listDisplay id/title/authorId/status/publishedAt, searchFields title, listFilter status/authorId/publishedAt, listPerPage 20, toString title.
  - tags: defaults only.
- `const app = new Hono(); app.get("/", c => c.redirect("/admin/")); app.route("/admin", admin.app);` (in `app.ts`). Changed 2026-10-08 (decision 048): `server.ts` wraps it as `const root = new Hono(); root.use("*", hostGuard(hostname, port)); root.route("/", app);` and serves `root`, so it is served by `@hono/node-server` with `serve({ fetch: root.fetch, port, hostname })`, where `port = Number(process.env.PORT ?? 3000)` and `hostname = process.env.HOST || "127.0.0.1"` (`||`, not `??`: an unset or empty `HOST` both give `127.0.0.1`). `serve` passes `hostname` to `server.listen(port, hostname)` (evidence: 2026-10-08-hono-head-cookie-body-node-server), and Node listens on all interfaces for an empty hostname (evidence: 2026-10-08-node-listen-empty-hostname), so by default the demo with its default password is reachable only from the local machine. Prints the URL built from `hostname` and `port` (an IPv6 literal in brackets) and the login hint (decision 038).

### `example/host-guard.ts` (decision 048)
Changed 2026-10-08: new module; DNS-rebinding protection for the demo (security audit, views.findings).
```ts
export function isAllowedHost(requestUrl: string, bindHost: string, port: number): boolean;
export function hostGuard(bindHost: string, port: number): MiddlewareHandler;
```
- `isAllowedHost`: `u = new URL(requestUrl)`; `h = u.hostname` (lowercase, IPv6 in brackets); effective port = `Number(u.port)`, or 443 for `https:` / 80 otherwise when `u.port` is `""`. `b` = `bindHost.toLowerCase()`, wrapped in `[...]` when it contains `:`. Loopback names: `localhost`, `127.0.0.1`, `[::1]`. Wildcards: `0.0.0.0`, `[::]`. Returns true only when the effective port equals `port` and at least one holds: `h === b`; `b` is a loopback name or a wildcard and `h` is a loopback name; `b` is a wildcard and `h` is an IP literal (`/^\d{1,3}(\.\d{1,3}){3}$/` or starting with `[`). An IP-literal Host cannot come from DNS rebinding, which needs an attacker-controlled name, so LAN access by IP keeps working under `HOST=0.0.0.0`.
- `hostGuard`: middleware; when `isAllowedHost(c.req.url, bindHost, port)` is false it returns `c.text("Forbidden: unexpected Host header", 403)` and does not call `next`. `@hono/node-server` builds `c.req.url` from the Host header (evidence: 2026-10-08-hono-head-cookie-body-node-server). The text is example code, not a library UI string, so it is not in `src/messages.ts`.
- `createExampleApp` does not use it (the smoke tests call `app.request` with `http://localhost/`).

## Data formats
Run instructions (also in the README "Development" section):
```
mise install          # node 24.21.0 and pnpm 12.10.0 from mise.toml
pnpm install
pnpm example          # then open http://127.0.0.1:3000/admin/ and log in as admin / admin
HOST=0.0.0.0 pnpm example   # listen on all interfaces (set ADMIN_PASSWORD first)
```

## Errors
- Startup failures (port in use, etc.) surface as the thrown error; no special handling.
