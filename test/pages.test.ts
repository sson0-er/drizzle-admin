import { Hono } from "hono";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { messages } from "../src/messages.js";
import { createClient, makeAdmin, type TestAdmin } from "./helpers/app.js";
import { dialects } from "./helpers/db.js";
import { parse, qs, qsa, text } from "./helpers/html.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(dialects)("app shell pages ($name)", (fixture) => {
  let t: TestAdmin;
  beforeAll(async () => {
    t = await makeAdmin(fixture);
  });
  afterAll(async () => {
    await t.close();
  });

  /** A new cookie jar, logged in unless `loggedIn` is false. */
  const freshClient = async (loggedIn = true) => {
    const client = createClient((req) => t.admin.fetch(req));
    if (loggedIn) await client.login();
    return client;
  };

  it("serves the dashboard with a session cookie", async () => {
    // External auth lets a cookie-less request through, so the response issues the session.
    const ext = await makeAdmin(dialects[0] as (typeof dialects)[number], {
      config: { auth: { getUser: async () => ({ id: "ext", name: "external-user" }) } },
    });
    const res = await ext.client.get("/admin/");
    await ext.close();
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("da_session="))).toBe(true);
    const doc = parse(await res.text());
    const table = qs(doc, { tag: "table", id: "dashboard" });
    expect(table).not.toBeNull();
    if (table === null) return;
    expect(qsa(table, { tag: "tr", attrs: { "data-model": "authors" } })).toHaveLength(1);
  });

  it("serves the stylesheet with a long-term cache header", async () => {
    const res = await (await freshClient(false)).get("/admin/static/admin.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/css; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    // The stylesheet is public: no session cookie.
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("redirects a path without trailing slash, keeping the query", async () => {
    const client = await freshClient();
    const bare = await client.get("/admin");
    expect(bare.status).toBe(301);
    expect(bare.headers.get("Location")).toBe("/admin/");
    const withQuery = await client.get("/admin/authors/1/change?x=1");
    expect(withQuery.status).toBe(301);
    expect(withQuery.headers.get("Location")).toBe("/admin/authors/1/change/?x=1");
  });

  it("renders unknown slashed paths as a 404 layout page", async () => {
    const res = await (await freshClient()).get("/admin/a/b/c/");
    expect(res.status).toBe(404);
    const doc = parse(await res.text());
    expect(qs(doc, { tag: "h1" })).not.toBeNull();
    expect(text(doc)).toContain(messages.notFound);
  });

  it("answers unmatched methods with the 404 page when mounted under an outer app", async () => {
    const outer = new Hono().route("/admin", t.admin.app);
    const client = createClient((req) => outer.fetch(req));
    await client.login();

    // client.post adds the valid session token, so a 404 (not 403) shows the token check passed.
    const post = await client.post("/admin/nope/x/y/");
    expect(post.status).toBe(404);
    expect(post.headers.get("Content-Type")).toContain("text/html");
    expect(qs(parse(await post.text()), { tag: "h1" })).not.toBeNull();

    const put = await client.request("/admin/authors/", {
      method: "PUT",
      // Without a content type hono/csrf treats the request as a form post and needs an Origin.
      headers: { Origin: "http://localhost" },
    });
    expect(put.status).toBe(404);
    expect(put.headers.get("Content-Type")).toContain("text/html");
    const doc = parse(await put.text());
    expect(qs(doc, { tag: "h1" })).not.toBeNull();
    expect(text(doc)).toContain(messages.notFound);
  });

  it("rejects a POST without a token with the CSRF 403 page", async () => {
    const client = await freshClient();
    await client.get("/admin/");
    const res = await client.post("/admin/nope/", {}, { withToken: false });
    expect(res.status).toBe(403);
    expect(text(parse(await res.text()))).toContain(messages.csrfFailed);
  });

  it("rejects a wrong token", async () => {
    const client = await freshClient();
    await client.get("/admin/");
    const res = await client.post("/admin/nope/", { _csrf: "wrong" }, { withToken: false });
    expect(res.status).toBe(403);
    expect(text(parse(await res.text()))).toContain(messages.csrfFailed);
  });

  it("rejects a POST without a session cookie even when a token is sent", async () => {
    // External auth again: in builtin mode a cookie-less POST is sent to login before the token check.
    const ext = await makeAdmin(dialects[0] as (typeof dialects)[number], {
      config: { auth: { getUser: async () => ({ id: "ext", name: "external-user" }) } },
    });
    const res = await ext.client.post("/admin/nope/", { _csrf: "anything" }, { withToken: false });
    await ext.close();
    expect(res.status).toBe(403);
  });

  it("rejects a foreign Origin with the layout 403 page even with a valid token", async () => {
    const client = await freshClient();
    await client.get("/admin/");
    const res = await client.post(
      "/admin/nope/",
      {},
      { headers: { Origin: "http://evil.example" } },
    );
    expect(res.status).toBe(403);
    const doc = parse(await res.text());
    expect(text(doc)).toContain(messages.csrfFailed);
    expect(qs(doc, { tag: "p", cls: "error-message" })).not.toBeNull();
  });
});

describe("trailing-slash redirect guard", () => {
  const sqlite = dialects[0] as (typeof dialects)[number];

  describe.each([
    {
      basePath: "/",
      paths: [
        "//evil.example",
        "///evil.example",
        "/%5Cevil.example",
        "/%09/evil.example",
        "/%09%09/evil.example",
        "/%5C%09evil.example",
        "/%0a/evil.example",
        "/%0d/evil.example",
      ],
    },
    {
      basePath: "/admin",
      paths: [
        "/admin//evil.example",
        "/admin/%5Cevil.example",
        "/admin/%09/evil.example",
        "/admin/%0a/evil.example",
        "/admin/%0d/evil.example",
      ],
    },
  ])("basePath $basePath", ({ basePath, paths }) => {
    it.each(paths)("never redirects %s", async (path) => {
      const t = await makeAdmin(sqlite, { config: { basePath } });
      try {
        const res = await t.client.get(path);
        expect(res.status).toBe(404);
        expect(res.headers.get("Location")).toBeNull();
      } finally {
        await t.close();
      }
    });
  });

  it("serves the dashboard at / with basePath /", async () => {
    const t = await makeAdmin(sqlite, { config: { basePath: "/" } });
    try {
      const res = await t.client.get("/");
      expect(res.status).toBe(200);
      expect(qs(parse(await res.text()), { tag: "table", id: "dashboard" })).not.toBeNull();
    } finally {
      await t.close();
    }
  });

  it("still redirects an ordinary unslashed path with basePath /", async () => {
    const t = await makeAdmin(sqlite, { config: { basePath: "/" } });
    try {
      const res = await t.client.get("/users?a=1");
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe("/users/?a=1");
    } finally {
      await t.close();
    }
  });
});

describe("external auth mode", () => {
  it("renders a 500 page and logs the error when getUser throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await makeAdmin(dialects[0] as (typeof dialects)[number], {
      config: {
        auth: {
          getUser: async () => {
            throw new Error("getUser exploded");
          },
        },
      },
    });
    try {
      const res = await t.client.get("/admin/");
      expect(res.status).toBe(500);
      expect(text(parse(await res.text()))).toContain(messages.serverError);
      const logged = error.mock.calls.flat();
      expect(logged.some((a) => a instanceof Error && a.message === "getUser exploded")).toBe(true);
    } finally {
      await t.close();
    }
  });

  it("serves the dashboard for the user returned by getUser", async () => {
    const t = await makeAdmin(dialects[0] as (typeof dialects)[number], {
      config: { auth: { getUser: async () => ({ id: "ext", name: "external-user" }) } },
    });
    try {
      const res = await t.client.get("/admin/");
      expect(res.status).toBe(200);
      expect(text(parse(await res.text()))).toContain("external-user");
    } finally {
      await t.close();
    }
  });
});
