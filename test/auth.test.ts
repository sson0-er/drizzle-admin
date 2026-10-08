import { serializeSigned } from "hono/utils/cookie";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { parse, qs, text } from "./helpers/html.js";

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
