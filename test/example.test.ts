import { describe, expect, it } from "vitest";
import { createExampleApp } from "../example/app.js";

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
    for (const path of ["/admin/", "/admin/users/", "/admin/posts/", "/admin/tags/"]) {
      const res = await app.request(path);
      expect(res.status, path).toBe(200);
    }
  });
});
