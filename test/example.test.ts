import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExampleApp } from "../example/app.js";
import { posts } from "../example/schema.js";
import { createSchema, seed } from "../example/seed.js";
import { createClient } from "./helpers/app.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("example app (phase 1)", () => {
  it("builds with schema, seed and all registrations, and redirects / to /admin/", async () => {
    const { app } = await createExampleApp({ secret: "s".repeat(32), adminPassword: "x" });
    const res = await app.request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/");
  });
});

describe("example app (phase 2)", () => {
  it("serves the dashboard and every model list", async () => {
    const { app } = await createExampleApp({ secret: "s".repeat(32), adminPassword: "x" });
    const client = createClient((req) => app.fetch(req));
    await client.login({ username: "admin", password: "x" });
    for (const path of ["/admin/", "/admin/users/", "/admin/posts/", "/admin/tags/"]) {
      const res = await client.get(path);
      expect(res.status, path).toBe(200);
    }
  });
});

describe("example app (phase 3)", () => {
  it("serves the add page of every model", async () => {
    const { app } = await createExampleApp({ secret: "s".repeat(32), adminPassword: "x" });
    const client = createClient((req) => app.fetch(req));
    await client.login({ username: "admin", password: "x" });
    for (const path of ["/admin/users/add/", "/admin/posts/add/", "/admin/tags/add/"]) {
      const res = await client.get(path);
      expect(res.status, path).toBe(200);
    }
  });
});

describe("example app (phase 5)", () => {
  it("serves the login page while logged out", async () => {
    const { app } = await createExampleApp({ secret: "s".repeat(32), adminPassword: "x" });
    const res = await createClient((req) => app.fetch(req)).get("/admin/login/");
    expect(res.status).toBe(200);
  });

  it("serves the dashboard and every model list after logging in as admin", async () => {
    const { app } = await createExampleApp({ secret: "s".repeat(32), adminPassword: "x" });
    const client = createClient((req) => app.fetch(req));
    const login = await client.login({ username: "admin", password: "x" });
    expect(login.status).toBe(303);
    for (const path of ["/admin/", "/admin/users/", "/admin/posts/", "/admin/tags/"]) {
      const res = await client.get(path);
      expect(res.status, path).toBe(200);
    }
  });
});

describe("example seed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Local-time constructors keep the day of month independent of the process time zone.
  it.each([
    { name: "the 1st", now: new Date(2026, 10, 1, 12), ages: [0, 2, 5, 40, 75] },
    { name: "the 5th", now: new Date(2026, 10, 5, 12), ages: [0, 2, 4, 5, 40, 75] },
  ])("spreads publish ages over $name of the month", async ({ now, ages }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    const sqlite = new Database(":memory:");
    createSchema(sqlite);
    const db = drizzle(sqlite);
    await seed(db);
    const rows = await db.select().from(posts);
    sqlite.close();
    const published = rows.flatMap((p) =>
      p.publishedAt === null
        ? []
        : [Math.round((now.getTime() - p.publishedAt.getTime()) / DAY_MS)],
    );
    expect([...new Set(published)].sort((a, b) => a - b)).toEqual(ages);
  });
});
