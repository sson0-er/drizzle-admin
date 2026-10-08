import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SELECT_ALL_SCRIPT_SHA256 } from "../src/static/select-all.js";
import { makeAdmin, TEST_USER, type TestAdmin } from "./helpers/app.js";
import { dialects } from "./helpers/db.js";

const CSP_BASE = `default-src 'none'; script-src 'sha256-${SELECT_ALL_SCRIPT_SHA256}'; style-src 'self'; `;
const CSP_TAIL = "frame-ancestors 'none'; base-uri 'none'";
const BUILTIN_CSP = `${CSP_BASE}form-action 'self'; ${CSP_TAIL}`;
const EXTERNAL_CSP = `${CSP_BASE}${CSP_TAIL}`;

describe.each(dialects)("response headers ($name)", (fixture) => {
  let t: TestAdmin;
  beforeAll(async () => {
    t = await makeAdmin(fixture);
  });
  afterAll(async () => {
    await t.close();
  });

  const expectHardened = (res: Response) => {
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("same-origin");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Security-Policy")).toBe(BUILTIN_CSP);
  };

  it("sets no-store and hardening headers on a 200 page", async () => {
    const res = await t.client.get("/admin/");
    expect(res.status).toBe(200);
    expectHardened(res);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets them on a 301 redirect", async () => {
    const res = await t.client.get("/admin");
    expect(res.status).toBe(301);
    expectHardened(res);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets them on a 404 page", async () => {
    const res = await t.client.get("/admin/a/b/c/");
    expect(res.status).toBe(404);
    expectHardened(res);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets them on the token 403 page and on the Origin 403 page", async () => {
    await t.client.get("/admin/");
    const noToken = await t.client.post("/admin/nope/", {}, { withToken: false });
    expect(noToken.status).toBe(403);
    expectHardened(noToken);
    expect(noToken.headers.get("Cache-Control")).toBe("no-store");

    const evil = await t.client.post(
      "/admin/nope/",
      {},
      { headers: { Origin: "http://evil.example" } },
    );
    expect(evil.status).toBe(403);
    expectHardened(evil);
    expect(evil.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps the long-term Cache-Control on the static CSS instead of no-store", async () => {
    const res = await t.client.get("/admin/static/admin.css");
    expect(res.status).toBe(200);
    expectHardened(res);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("sets them on the onError 500 page", async () => {
    const failing = await makeAdmin(fixture, {
      models: {
        kv: {
          formatters: {
            value: () => {
              throw new Error("boom");
            },
          },
        },
      },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await failing.client.get("/admin/kv/");
      expect(res.status).toBe(500);
      expectHardened(res);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    } finally {
      log.mockRestore();
      await failing.close();
    }
  });

  it("omits form-action from the policy in external mode", async () => {
    const external = await makeAdmin(fixture, {
      config: {
        auth: { getUser: async () => TEST_USER, loginUrl: "https://sso.example.com/login" },
      },
    });
    try {
      const res = await external.client.get("/admin/");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Security-Policy")).toBe(EXTERNAL_CSP);
      expect(res.headers.get("Content-Security-Policy")).not.toContain("form-action");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    } finally {
      await external.close();
    }
  });
});
