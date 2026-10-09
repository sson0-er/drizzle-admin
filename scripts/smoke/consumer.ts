import { PGlite } from "@electric-sql/pglite";
import { type AdminConfig, createAdmin } from "@sson0-er/drizzle-admin";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { pgTable, text as pgText, serial } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/pglite";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";

const secret = "s".repeat(32);
const auth: AdminConfig["auth"] = { getUser: async () => ({ id: "smoke", name: "smoke" }) };

async function expectPage(
  label: string,
  fetch: (req: Request) => Response | Promise<Response>,
  path: string,
  text?: string,
): Promise<void> {
  const res = await fetch(new Request(`http://localhost${path}`));
  if (res.status !== 200) {
    throw new Error(`${label} ${path}: status ${res.status}`);
  }
  if (text !== undefined && !(await res.text()).includes(text)) {
    throw new Error(`${label} ${path}: "${text}" missing`);
  }
}

const sqlite = new Database(":memory:");
sqlite.exec(
  "create table items (id integer primary key autoincrement, name text not null); insert into items (name) values ('smoke-row')",
);
const items = sqliteTable("items", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
});
const sqliteAdmin = createAdmin({
  db: drizzle(sqlite),
  dialect: "sqlite",
  basePath: "/admin",
  secret,
  auth,
});
sqliteAdmin.register(items, { listDisplay: ["id", "name"] });
// Mounted in the consumer's own app: proves the peer Hono type and instance are shared.
const app = new Hono();
app.route("/admin", sqliteAdmin.app);
await expectPage("sqlite", (req) => app.fetch(req), "/admin/");
await expectPage("sqlite", (req) => app.fetch(req), "/admin/items/", "smoke-row");
sqlite.close();
console.log("ok sqlite");

const pg = new PGlite();
await pg.exec(
  "create table items (id serial primary key, name text not null); insert into items (name) values ('smoke-row')",
);
const pgItems = pgTable("items", { id: serial().primaryKey(), name: pgText().notNull() });
const pgAdmin = createAdmin({
  db: drizzlePg(pg),
  dialect: "postgres",
  basePath: "/admin",
  secret,
  auth,
});
pgAdmin.register(pgItems);
await expectPage("postgres", (req) => pgAdmin.fetch(req), "/admin/");
await expectPage("postgres", (req) => pgAdmin.fetch(req), "/admin/items/", "smoke-row");
await pg.close();
console.log("ok postgres");

// Compiled but never called: only the type check matters.
function typeOnly(): void {
  // @ts-expect-error "missing" is not a column of items (column keys stay typed after packing)
  sqliteAdmin.register(items, { slug: "typecheck", listDisplay: ["missing"] });
}
void typeOnly;
