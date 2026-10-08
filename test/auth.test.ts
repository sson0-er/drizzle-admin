import type { Table } from "drizzle-orm";
import { serializeSigned } from "hono/utils/cookie";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdmin, type ModelAdminOptions } from "../src/index.js";
import { messages } from "../src/messages.js";
import type { AdminUser } from "../src/types.js";
import {
  type Client,
  createClient,
  makeAdmin,
  TEST_PASSWORD,
  TEST_SECRET,
  TEST_USER,
  type TestAdmin,
} from "./helpers/app.js";
import { dialects } from "./helpers/db.js";
import { attr, type Node, parse, qs, qsa, text } from "./helpers/html.js";

const sqlite = dialects[0] as (typeof dialects)[number];

const location = (res: Response): string => res.headers.get("Location") ?? "";

/** The decoded `da_session` payload of the client's jar. */
function sessionOf(client: Client): { u: unknown; csrf: string; iat: number } {
  const raw = client.cookie("da_session");
  if (raw === undefined) throw new Error("no da_session cookie");
  const signed = decodeURIComponent(raw);
  return JSON.parse(signed.slice(0, signed.lastIndexOf(".")));
}

/** A `Cookie` header value signed like the library does, for crafting odd sessions. */
async function signedCookie(
  session: { u: AdminUser | null; csrf: string; iat: number },
  secret: string,
): Promise<string> {
  const line = await serializeSigned("da_session", JSON.stringify(session), secret);
  return line.split(";")[0] ?? "";
}

const now = () => Math.floor(Date.now() / 1000);

describe.each(dialects)("login, logout and auth guard ($name)", (fixture) => {
  let t: TestAdmin;
  const fresh = () => createClient((req) => t.admin.fetch(req));

  beforeAll(async () => {
    t = await makeAdmin(fixture, { login: false });
  });
  afterAll(async () => {
    await t.close();
  });

  describe("redirect to login", () => {
    it("redirects a logged-out GET with the encoded path and query as next", async () => {
      const res = await fresh().get("/admin/authors/?q=a");
      expect(res.status).toBe(302);
      expect(location(res)).toBe("/admin/login/?next=%2Fadmin%2Fauthors%2F%3Fq%3Da");
    });

    it("lands on next after logging in", async () => {
      const client = fresh();
      const redirect = await client.get("/admin/authors/?q=a");
      const next = new URL(location(redirect), "http://localhost").searchParams.get("next");
      expect(next).toBe("/admin/authors/?q=a");
      const res = await client.login({ next: next ?? "" });
      expect(res.status).toBe(303);
      expect(location(res)).toBe("/admin/authors/?q=a");
      expect((await client.get(location(res))).status).toBe(200);
    });

    it("keeps an encoded path round-tripping through login (decision 032)", async () => {
      const client = fresh();
      const redirect = await client.get("/admin/kv/a%20b/change/");
      expect(location(redirect)).toBe("/admin/login/?next=%2Fadmin%2Fkv%2Fa%2520b%2Fchange%2F");
      const next = new URL(location(redirect), "http://localhost").searchParams.get("next");
      const res = await client.login({ next: next ?? "" });
      expect(res.status).toBe(303);
      expect(location(res)).toBe("/admin/kv/a%20b/change/");
    });

    it("sends a logged-out POST to login with the dashboard as next", async () => {
      const client = fresh();
      // The guard runs before the token check, so a missing token is not a 403 here.
      const res = await client.post(
        "/admin/authors/",
        { action: "delete_selected" },
        { withToken: false },
      );
      expect(res.status).toBe(302);
      expect(location(res)).toBe("/admin/login/?next=%2Fadmin%2F");
    });

    it("serves the login page and the stylesheet while logged out", async () => {
      const client = fresh();
      const page = await client.get("/admin/login/");
      expect(page.status).toBe(200);
      const doc = parse(await page.text());
      expect(qs(doc, { tag: "form", id: "login-form" })).not.toBeNull();
      // No logout button without a user.
      expect(qs(doc, { tag: "form", attrs: { action: "/admin/logout/" } })).toBeNull();
      expect((await client.get("/admin/static/admin.css")).status).toBe(200);
    });
  });

  describe("login", () => {
    it("rejects a wrong password with 400, the failure message and no echoed password", async () => {
      const client = fresh();
      const secret = "not-the-password-xyz";
      const res = await client.login({ username: TEST_USER.name, password: secret });
      expect(res.status).toBe(400);
      const html = await res.text();
      expect(text(parse(html))).toContain(messages.loginFailed);
      expect(html).not.toContain(secret);
      // The username is kept for convenience, the password field stays empty.
      const doc = parse(html);
      expect(
        qs(doc, { tag: "input", attrs: { name: "username", value: TEST_USER.name } }),
      ).not.toBeNull();
      expect(qs(doc, { tag: "input", attrs: { name: "password", value: true } })).toBeNull();
      expect((await client.get("/admin/")).status).toBe(302);
    });

    it.each([["//evil.example"], ["https://evil.example"], ["/other/"]])(
      "falls back to the dashboard for next=%s",
      async (next) => {
        const res = await fresh().login({ next });
        expect(res.status).toBe(303);
        expect(location(res)).toBe("/admin/");
      },
    );

    it("issues a new CSRF token on login", async () => {
      const client = fresh();
      await client.get("/admin/login/");
      const before = client.csrf();
      await client.post("/admin/login/", { username: TEST_USER.name, password: TEST_PASSWORD });
      expect(sessionOf(client).csrf).not.toBe(before);
    });

    it("redirects a logged-in GET of the login page to next, safely", async () => {
      const client = fresh();
      await client.login();
      const ok = await client.get("/admin/login/?next=%2Fadmin%2Fauthors%2F");
      expect(ok.status).toBe(302);
      expect(location(ok)).toBe("/admin/authors/");
      const evil = await client.get("/admin/login/?next=%2F%2Fevil.example");
      expect(location(evil)).toBe("/admin/");
    });

    it("shows the user name and a logout button after login", async () => {
      const client = fresh();
      await client.login();
      const doc = parse(await (await client.get("/admin/")).text());
      expect(text(doc)).toContain(TEST_USER.name);
      expect(qs(doc, { tag: "form", attrs: { action: "/admin/logout/" } })).not.toBeNull();
    });
  });

  describe("logout", () => {
    it("clears the session and sends the next request to login", async () => {
      const client = fresh();
      await client.login();
      expect((await client.get("/admin/")).status).toBe(200);
      const res = await client.post("/admin/logout/");
      expect(res.status).toBe(303);
      expect(location(res)).toBe("/admin/login/");
      const after = await client.get("/admin/");
      expect(after.status).toBe(302);
      expect(location(after)).toBe("/admin/login/?next=%2Fadmin%2F");
    });

    it("requires the CSRF token", async () => {
      const client = fresh();
      await client.login();
      const res = await client.post("/admin/logout/", {}, { withToken: false });
      expect(res.status).toBe(403);
      expect((await client.get("/admin/")).status).toBe(200);
    });
  });

  describe("session cookie", () => {
    it("treats a tampered cookie as logged out", async () => {
      const client = fresh();
      await client.login();
      const session = sessionOf(client);
      const forged = await signedCookie({ ...session, u: { id: "9", name: "root" } }, TEST_SECRET);
      // Swap the signed payload of a genuine cookie for another one, keeping the old signature.
      const genuine = decodeURIComponent(client.cookie("da_session") ?? "");
      const signature = genuine.slice(genuine.lastIndexOf(".") + 1);
      const forgedValue = decodeURIComponent(forged.split("=").slice(1).join("="));
      const tampered = `da_session=${encodeURIComponent(
        `${forgedValue.slice(0, forgedValue.lastIndexOf("."))}.${signature}`,
      )}`;
      const res = await t.admin.fetch(
        new Request("http://localhost/admin/", { headers: { Cookie: tampered } }),
      );
      expect(res.status).toBe(302);
      expect(location(res)).toBe("/admin/login/?next=%2Fadmin%2F");
    });

    it("treats a cookie signed with another secret as logged out", async () => {
      const cookie = await signedCookie(
        { u: TEST_USER, csrf: "c".repeat(43), iat: now() },
        "another-secret-another-secret-another-0123",
      );
      const res = await t.admin.fetch(
        new Request("http://localhost/admin/", { headers: { Cookie: cookie } }),
      );
      expect(res.status).toBe(302);
      expect(location(res)).toBe("/admin/login/?next=%2Fadmin%2F");
    });

    it("accepts a hand-signed cookie with the right secret, and rejects an expired one", async () => {
      const fetchWith = async (iat: number) =>
        t.admin.fetch(
          new Request("http://localhost/admin/", {
            headers: {
              Cookie: await signedCookie({ u: TEST_USER, csrf: "c".repeat(43), iat }, TEST_SECRET),
            },
          }),
        );
      // Control: the crafting itself works, so the rejection below is about the age.
      expect((await fetchWith(now() - 60)).status).toBe(200);
      const expired = await fetchWith(now() - 28800 - 10);
      expect(expired.status).toBe(302);
      expect(location(expired)).toBe("/admin/login/?next=%2Fadmin%2F");
    });

    it("stores only u, csrf and iat", async () => {
      const client = fresh();
      await client.login();
      const session = sessionOf(client);
      expect(Object.keys(session).sort()).toEqual(["csrf", "iat", "u"]);
      expect(session.u).toEqual(TEST_USER);
    });

    it("sets HttpOnly, SameSite=Lax and Path, and Secure only over https", async () => {
      const client = fresh();
      await client.get("/admin/login/");
      const login = await client.post("/admin/login/", {
        username: TEST_USER.name,
        password: TEST_PASSWORD,
      });
      const httpLine = login.headers.getSetCookie().find((l) => l.startsWith("da_session=")) ?? "";
      expect(httpLine).toMatch(/;\s*HttpOnly/i);
      expect(httpLine).toMatch(/;\s*SameSite=Lax/i);
      expect(httpLine).toMatch(/;\s*Path=\/admin(;|$)/);
      expect(httpLine).not.toMatch(/;\s*Secure/i);

      const https = await t.admin.fetch(new Request("https://localhost/admin/login/"));
      const httpsLine = https.headers.getSetCookie().find((l) => l.startsWith("da_session=")) ?? "";
      expect(httpsLine).toMatch(/;\s*Secure/i);
      expect(httpsLine).toMatch(/;\s*HttpOnly/i);
    });
  });

  describe("CSRF token and Origin check", () => {
    const form = { action: "delete_selected" };
    let client: Client;
    beforeAll(async () => {
      client = fresh();
      await client.login();
    });

    it("rejects a POST without _csrf", async () => {
      const res = await client.post("/admin/authors/", form, { withToken: false });
      expect(res.status).toBe(403);
      expect(text(parse(await res.text()))).toContain(messages.csrfFailed);
    });

    it("rejects a wrong token", async () => {
      const res = await client.post(
        "/admin/authors/",
        { ...form, _csrf: "wrong" },
        { withToken: false },
      );
      expect(res.status).toBe(403);
    });

    it("accepts the session's token", async () => {
      const res = await client.post("/admin/authors/", form);
      expect(res.status).toBe(303);
    });

    it("rejects a correct token with a foreign Origin", async () => {
      const res = await client.post("/admin/authors/", form, {
        headers: { Origin: "http://evil.example" },
      });
      expect(res.status).toBe(403);
    });

    it("rejects a correct token with neither Origin nor Sec-Fetch-Site", async () => {
      const params = new URLSearchParams({ ...form, _csrf: client.csrf() });
      const res = await client.request("/admin/authors/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      expect(res.status).toBe(403);
    });
  });
});

describe("external auth mode", () => {
  const changeForm = {
    name: "alice",
    email: "alice@example.com",
    active: "on",
    role: "admin",
    createdAt: "2026-01-01T09:00",
    _save: "1",
  };
  let current: AdminUser | null = null;
  const getUser = async () => current;
  let withUrl: TestAdmin;
  let withoutUrl: TestAdmin;

  beforeAll(async () => {
    const auth = { getUser, loginUrl: "https://sso.example/login" };
    withUrl = await makeAdmin(sqlite, { config: { auth } });
    withoutUrl = await makeAdmin(sqlite, { config: { auth: { getUser } } });
  });
  afterAll(async () => {
    await withUrl.close();
    await withoutUrl.close();
  });

  it("redirects to loginUrl with the encoded next when getUser returns null", async () => {
    current = null;
    const res = await withUrl.client.get("/admin/authors/?q=a");
    expect(res.status).toBe(302);
    expect(location(res)).toBe("https://sso.example/login?next=%2Fadmin%2Fauthors%2F%3Fq%3Da");
  });

  it("answers 401 without a loginUrl", async () => {
    current = null;
    const res = await withoutUrl.client.get("/admin/");
    expect(res.status).toBe(401);
    expect(text(parse(await res.text()))).toContain(messages.unauthorized);
  });

  it("serves pages for the user from getUser", async () => {
    current = { id: "e1", name: "external-user" };
    const res = await withoutUrl.client.get("/admin/");
    expect(res.status).toBe(200);
    const doc = parse(await res.text());
    expect(text(doc)).toContain("external-user");
    // There is no logout in external mode.
    expect(qs(doc, { tag: "form", attrs: { action: "/admin/logout/" } })).toBeNull();
  });

  it("has no login or logout routes", async () => {
    current = { id: "e1", name: "external-user" };
    const client = createClient((req) => withoutUrl.admin.fetch(req));
    expect((await client.get("/admin/login/")).status).toBe(404);
    expect((await client.post("/admin/login/", { username: "a", password: "b" })).status).toBe(404);
    expect((await client.post("/admin/logout/")).status).toBe(404);
  });

  it("issues a session cookie with u null that carries the CSRF token", async () => {
    current = { id: "e1", name: "external-user" };
    const client = createClient((req) => withoutUrl.admin.fetch(req));
    await client.get("/admin/");
    const session = sessionOf(client);
    expect(session.u).toBeNull();
    expect(Object.keys(session).sort()).toEqual(["csrf", "iat", "u"]);
  });

  it("accepts a change POST with the cookie's token and rejects one without _csrf", async () => {
    current = { id: "e1", name: "external-user" };
    const client = createClient((req) => withoutUrl.admin.fetch(req));
    await client.get("/admin/");
    const token = sessionOf(client).csrf;
    const ok = await client.post(
      "/admin/authors/1/change/",
      { ...changeForm, _csrf: token },
      { withToken: false },
    );
    expect(ok.status).toBe(303);
    const missing = await client.post("/admin/authors/1/change/", changeForm, { withToken: false });
    expect(missing.status).toBe(403);
  });
});

type Permissions = NonNullable<ModelAdminOptions<Table>["permissions"]>;
type Perm = keyof Permissions;

const authorForm = {
  name: "zed",
  email: "zed@example.com",
  active: "on",
  role: "viewer",
  createdAt: "2026-01-01T09:00",
};

const docOf = async (res: Response): Promise<Node> => parse(await res.text());

/** Values of the options in `select[name=action]`; `null` when the dropdown is not rendered. */
function actionOptions(doc: Node): string[] | null {
  const select = qs(doc, { tag: "select", attrs: { name: "action" } });
  if (select === null) return null;
  return qsa(select, { tag: "option" }).map((o) => attr(o, "value") ?? "");
}

describe.each(dialects)("permissions in routes ($name)", (fixture) => {
  let t: TestAdmin;
  const tagRuns: string[][] = [];
  const actions: NonNullable<ModelAdminOptions<Table>["actions"]> = [
    {
      name: "tag",
      label: "Tag",
      run: async ({ ids }) => {
        tagRuns.push(ids);
        return { message: "Tagged!" };
      },
    },
  ];

  /** Another admin over the same database, so one PGlite instance serves every permission set. */
  async function clientWith(permissions: Permissions): Promise<Client> {
    const admin = createAdmin({
      db: t.db,
      dialect: fixture.dialect,
      basePath: "/admin",
      secret: TEST_SECRET,
      auth: {
        verifyCredentials: async (username, password) =>
          username === TEST_USER.name && password === TEST_PASSWORD ? TEST_USER : null,
      },
    });
    admin.register(t.schema.authors, { permissions, actions });
    const client = createClient((req) => admin.fetch(req));
    expect((await client.login()).status).toBe(303);
    return client;
  }
  const without = (perm: Perm): Permissions => ({ [perm]: false });

  beforeAll(async () => {
    t = await makeAdmin(fixture, { login: false });
  });
  afterAll(async () => {
    await t.close();
  });

  describe("403 for each missing permission", () => {
    const cases: {
      perm: Perm;
      method: "GET" | "POST";
      path: string;
      form?: Record<string, string>;
    }[] = [
      { perm: "view", method: "GET", path: "/admin/authors/" },
      { perm: "view", method: "GET", path: "/admin/authors/1/change/" },
      { perm: "add", method: "GET", path: "/admin/authors/add/" },
      { perm: "add", method: "POST", path: "/admin/authors/add/", form: authorForm },
      { perm: "change", method: "POST", path: "/admin/authors/1/change/", form: authorForm },
      { perm: "delete", method: "GET", path: "/admin/authors/1/delete/" },
      { perm: "delete", method: "POST", path: "/admin/authors/1/delete/" },
      {
        perm: "delete",
        method: "POST",
        path: "/admin/authors/",
        form: { action: "delete_selected", _selected: "1" },
      },
    ];

    it.each(cases)("$perm false: $method $path -> 403", async ({ perm, method, path, form }) => {
      const denied = await clientWith(without(perm));
      const res = method === "GET" ? await denied.get(path) : await denied.post(path, form);
      expect(res.status).toBe(403);

      // Control: with every permission the same request is not refused, so the 403 is the gate.
      const allowed = await clientWith({});
      const ok = method === "GET" ? await allowed.get(path) : await allowed.post(path, form);
      expect(ok.status).not.toBe(403);
    });

    it("leaves the data alone when delete is refused", async () => {
      const denied = await clientWith(without("delete"));
      await denied.post("/admin/authors/1/delete/");
      await denied.post("/admin/authors/", { action: "delete_selected", _selected: "1" });
      expect((await (await clientWith({})).get("/admin/authors/1/change/")).status).toBe(200);
    });
  });

  describe("hidden controls", () => {
    it("shows both add links with every permission", async () => {
      const client = await clientWith({});
      expect(
        qs(await docOf(await client.get("/admin/")), { tag: "a", cls: "addlink" }),
      ).not.toBeNull();
      expect(
        qs(await docOf(await client.get("/admin/authors/")), { tag: "a", cls: "addlink" }),
      ).not.toBeNull();
    });

    it("hides the dashboard and list add links without add", async () => {
      const client = await clientWith(without("add"));
      const dashboard = await client.get("/admin/");
      expect(dashboard.status).toBe(200);
      expect(qs(await docOf(dashboard), { tag: "a", cls: "addlink" })).toBeNull();
      const list = await client.get("/admin/authors/");
      expect(list.status).toBe(200);
      expect(qs(await docOf(list), { tag: "a", cls: "addlink" })).toBeNull();
    });

    it("shows the save buttons and delete link of the change page with every permission", async () => {
      const doc = await docOf(await (await clientWith({})).get("/admin/authors/1/change/"));
      for (const name of ["_save", "_addanother", "_continue"]) {
        expect(qs(doc, { tag: "button", attrs: { name } }), name).not.toBeNull();
      }
      expect(qs(doc, { tag: "a", cls: "deletelink" })).not.toBeNull();
    });

    it("hides the save buttons but keeps the delete link without change", async () => {
      const res = await (await clientWith(without("change"))).get("/admin/authors/1/change/");
      expect(res.status).toBe(200);
      const doc = await docOf(res);
      for (const name of ["_save", "_addanother", "_continue"]) {
        expect(qs(doc, { tag: "button", attrs: { name } }), name).toBeNull();
      }
      expect(qs(doc, { tag: "a", cls: "deletelink" })).not.toBeNull();
    });

    it("hides the delete link but keeps the save buttons without delete", async () => {
      const doc = await docOf(
        await (await clientWith(without("delete"))).get("/admin/authors/1/change/"),
      );
      expect(qs(doc, { tag: "a", cls: "deletelink" })).toBeNull();
      expect(qs(doc, { tag: "button", attrs: { name: "_save" } })).not.toBeNull();
    });

    it("gives a view-only user a change page without save buttons", async () => {
      const client = await clientWith({ add: false, change: false, delete: false });
      const res = await client.get("/admin/authors/1/change/");
      expect(res.status).toBe(200);
      const doc = await docOf(res);
      expect(qs(doc, { tag: "button", attrs: { name: "_save" } })).toBeNull();
      expect(qs(doc, { tag: "a", cls: "deletelink" })).toBeNull();
    });

    it("offers delete_selected in the action dropdown only with delete", async () => {
      const allowed = await docOf(await (await clientWith({})).get("/admin/authors/"));
      expect(actionOptions(allowed)).toContain("delete_selected");
      const denied = await docOf(
        await (await clientWith(without("delete"))).get("/admin/authors/"),
      );
      // The custom action keeps the dropdown rendered, so this is not an absent-select pass.
      expect(actionOptions(denied)).toContain("tag");
      expect(actionOptions(denied)).not.toContain("delete_selected");
    });
  });

  describe("custom actions need change (decision 016)", () => {
    it("neither offers nor runs a custom action with change false and delete true", async () => {
      const client = await clientWith({ change: false, delete: true });
      const options = actionOptions(await docOf(await client.get("/admin/authors/")));
      expect(options).toContain("delete_selected");
      expect(options).not.toContain("tag");
      const before = tagRuns.length;
      const res = await client.post("/admin/authors/", { action: "tag", _selected: "1" });
      expect(res.status).toBe(403);
      expect(tagRuns).toHaveLength(before);
    });

    it("offers and runs it with change true, with its flash", async () => {
      const client = await clientWith({ change: true });
      expect(actionOptions(await docOf(await client.get("/admin/authors/")))).toContain("tag");
      const before = tagRuns.length;
      const res = await client.post("/admin/authors/", { action: "tag", _selected: "1" });
      expect(res.status).toBe(303);
      expect(tagRuns.slice(before)).toEqual([["1"]]);
      const list = await docOf(await client.get(location(res)));
      const flash = qs(list, { tag: "ul", cls: "messagelist" });
      expect(flash === null ? "" : text(flash)).toContain("Tagged!");
    });
  });
});

describe.each(dialects)("XSS escaping ($name)", (fixture) => {
  const SCRIPT = "<script>alert(1)</script>";
  let t: TestAdmin;
  let id: string;

  beforeAll(async () => {
    t = await makeAdmin(fixture, {
      models: {
        authors: {
          listDisplay: ["id", "name", "email"],
          formatters: { email: () => "<b>x</b>" },
        },
      },
    });
    const db = t.db as {
      insert(table: Table): {
        values(v: object): PromiseLike<unknown>;
      };
    };
    await db.insert(t.schema.authors).values({ name: SCRIPT, email: "x@example.com" });
    const list = await docOf(await t.client.get("/admin/authors/?q=script"));
    const link = qsa(list, { tag: "a" }).find((a) => (attr(a, "href") ?? "").includes("/change/"));
    id = (attr(link as NonNullable<typeof link>, "href") ?? "").split("/").at(-3) ?? "";
  });
  afterAll(async () => {
    await t.close();
  });

  it("renders the list with the name as text and the formatter output escaped", async () => {
    const res = await t.client.get("/admin/authors/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain(SCRIPT);
    const doc = parse(html);
    expect(text(doc)).toContain(SCRIPT);
    // Only the select-all script of the list page may exist.
    const scripts = qsa(doc, { tag: "script" });
    expect(scripts).toHaveLength(1);
    expect(text(scripts[0] as NonNullable<(typeof scripts)[0]>)).not.toContain("alert(1)");
    expect(qsa(doc, { tag: "b" })).toHaveLength(0);
    expect(text(doc)).toContain("<b>x</b>");
  });

  it("renders the change page with the name as a field value, not as markup", async () => {
    expect(id).not.toBe("");
    const res = await t.client.get(`/admin/authors/${id}/change/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain(SCRIPT);
    const doc = parse(html);
    expect(qsa(doc, { tag: "script" })).toHaveLength(0);
    // A text column renders as an input or a textarea depending on the dialect.
    const field = qs(doc, { attrs: { id: "id_name" } });
    expect(field).not.toBeNull();
    const value =
      attr(field as NonNullable<typeof field>, "value") ?? text(field as NonNullable<typeof field>);
    expect(value).toBe(SCRIPT);
  });
});

describe.each(dialects)("FK view permission (decision 034) ($name)", (fixture) => {
  const NAMES = ["alice", "bob", "carol", "dave"];
  const articleOptions = {
    listDisplay: ["id", "title", "authorId"],
    listFilter: ["authorId"],
  };
  // The default label is "authors #<id>", so name the author to make a leak visible in the HTML.
  const authorOptions = (permissions: Permissions): ModelAdminOptions<Table> => ({
    permissions,
    toString: (row) => String((row as { name: unknown }).name),
  });
  let hidden: TestAdmin;
  let visible: Client;

  const htmlOf = async (client: Client, path: string): Promise<string> => {
    const res = await client.get(path);
    expect(res.status).toBe(200);
    return res.text();
  };
  const selected = (doc: Node): string[] =>
    qsa(doc, { tag: "input", attrs: { name: "_selected" } }).map((i) => attr(i, "value") ?? "");
  /** The `authorId` cell of the row of one article (the add test inserts a row, so no row index). */
  const authorIdCell = (doc: Node, articleId: string): Node => {
    const index = qsa(doc, { tag: "th" }).findIndex((th) => attr(th, "data-key") === "authorId");
    const row = qsa(doc, { tag: "tr" }).find(
      (tr) => qsa(tr, { tag: "input", attrs: { name: "_selected", value: articleId } }).length > 0,
    );
    return qsa(row as Node, { tag: "td" })[index] as Node;
  };
  const hasAuthorLink = (doc: Node): boolean =>
    qsa(doc, { tag: "a" }).some((a) => (attr(a, "href") ?? "").startsWith("/admin/authors/"));

  beforeAll(async () => {
    hidden = await makeAdmin(fixture, {
      models: {
        authors: authorOptions({ view: false }),
        articles: articleOptions,
      },
    });
    // A second admin over the same database, so one PGlite instance serves both permission sets.
    const admin = createAdmin({
      db: hidden.db,
      dialect: fixture.dialect,
      basePath: "/admin",
      secret: TEST_SECRET,
      auth: {
        verifyCredentials: async (username, password) =>
          username === TEST_USER.name && password === TEST_PASSWORD ? TEST_USER : null,
      },
    });
    admin.register(hidden.schema.authors, authorOptions({ view: true }));
    admin.register(hidden.schema.articles, articleOptions);
    visible = createClient((req) => admin.fetch(req));
    expect((await visible.login()).status).toBe(303);
  });
  afterAll(async () => {
    await hidden.close();
  });

  describe("without view on the referenced model", () => {
    it("shows the raw id in the FK cell without a link", async () => {
      const doc = parse(await htmlOf(hidden.client, "/admin/articles/"));
      const cell = authorIdCell(doc, "1");
      expect(text(cell)).toBe("1");
      expect(qsa(cell, { tag: "a" })).toEqual([]);
    });

    it.each([
      { page: "list", path: "/admin/articles/" },
      { page: "add", path: "/admin/articles/add/" },
      { page: "change", path: "/admin/articles/1/change/" },
    ])("shows no author name on the $page page", async ({ path }) => {
      const html = await htmlOf(hidden.client, path);
      expect(NAMES.filter((name) => html.includes(name))).toEqual([]);
    });

    it("offers no FK filter", async () => {
      const doc = parse(await htmlOf(hidden.client, "/admin/articles/"));
      expect(qs(doc, { tag: "div", attrs: { "data-filter": "authorId" } })).toBeNull();
    });

    it("ignores f_authorId", async () => {
      const all = selected(parse(await htmlOf(hidden.client, "/admin/articles/")));
      const filtered = selected(
        parse(await htmlOf(hidden.client, "/admin/articles/?f_authorId=1")),
      );
      expect(all.length).toBeGreaterThan(2);
      expect(filtered).toEqual(all);
    });

    it.each([
      { page: "add", path: "/admin/articles/add/" },
      { page: "change", path: "/admin/articles/1/change/" },
    ])("renders a plain number input on the $page page", async ({ path }) => {
      const doc = parse(await htmlOf(hidden.client, path));
      expect(qs(doc, { tag: "input", attrs: { name: "authorId", type: "number" } })).not.toBeNull();
      expect(qs(doc, { tag: "select", attrs: { name: "authorId" } })).toBeNull();
      expect(hasAuthorLink(doc)).toBe(false);
    });

    it("still saves a valid authorId", async () => {
      const res = await hidden.client.post("/admin/articles/add/", {
        title: "No view",
        authorId: "2",
      });
      expect(res.status).toBe(303);
    });
  });

  describe("with view on the referenced model", () => {
    it("shows the author label with a link and offers the filter", async () => {
      const doc = parse(await htmlOf(visible, "/admin/articles/"));
      const cell = authorIdCell(doc, "1");
      expect(text(cell)).toBe("alice");
      expect(attr(qs(cell, { tag: "a" }) as Node, "href")).toBe("/admin/authors/1/change/");
      expect(qs(doc, { tag: "div", attrs: { "data-filter": "authorId" } })).not.toBeNull();
    });

    it("renders a select on the add page", async () => {
      const doc = parse(await htmlOf(visible, "/admin/articles/add/"));
      expect(qs(doc, { tag: "select", attrs: { name: "authorId" } })).not.toBeNull();
    });
  });
});
