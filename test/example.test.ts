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
