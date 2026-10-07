import Database from "better-sqlite3";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";
import { type Admin, createAdmin } from "../src/index.js";
import { posts, tags, users } from "./schema.js";
import { createSchema, seed } from "./seed.js";

/** Builds the demo (in-memory SQLite, seeded) without opening a port; server.ts serves it. */
export async function createExampleApp(opts: {
  secret: string;
  adminPassword: string;
}): Promise<{ app: Hono; admin: Admin }> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  createSchema(sqlite);
  const db = drizzle(sqlite);
  await seed(db);

  const admin = createAdmin({
    db,
    dialect: "sqlite",
    basePath: "/admin",
    siteTitle: "drizzle-admin demo",
    secret: opts.secret,
    auth: {
      verifyCredentials: async (username, password) =>
        username === "admin" && password === opts.adminPassword
          ? { id: "admin", name: "admin" }
          : null,
    },
  });

  // Action ids arrive as strings; the primary key here is an integer.
  const setActive = (isActive: boolean) => async (ctx: { ids: string[] }) => {
    db.update(users)
      .set({ isActive })
      .where(inArray(users.id, ctx.ids.map(Number)))
      .run();
    return { message: `${ctx.ids.length} user(s) ${isActive ? "activated" : "deactivated"}` };
  };

  admin.register(users, {
    listDisplay: ["id", "email", "isActive", "createdAt"],
    searchFields: ["email", "name"],
    listFilter: ["isActive", "role"],
    ordering: ["-createdAt"],
    readonlyFields: ["createdAt"],
    toString: (row) => row.email,
    actions: [
      {
        name: "deactivate",
        label: "Deactivate selected users",
        confirm: true,
        run: setActive(false),
      },
      { name: "activate", label: "Activate selected users", run: setActive(true) },
    ],
  });
  admin.register(posts, {
    listDisplay: ["id", "title", "authorId", "status", "publishedAt"],
    searchFields: ["title"],
    listFilter: ["status", "authorId", "publishedAt"],
    listPerPage: 20,
    toString: (row) => row.title,
  });
  admin.register(tags);

  const app = new Hono();
  app.get("/", (c) => c.redirect("/admin/"));
  // Reading `admin.app` finalizes the registry, so registration errors surface here.
  app.route("/admin", admin.app);
  return { app, admin };
}
