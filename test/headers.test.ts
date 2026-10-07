import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeAdmin, type TestAdmin } from "./helpers/app.js";
import { dialects } from "./helpers/db.js";

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
});
