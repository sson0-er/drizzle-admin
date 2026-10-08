import { Hono } from "hono";
import { setSignedCookie } from "hono/cookie";
import { describe, expect, it } from "vitest";
import {
  type CookieOpts,
  clearSession,
  deriveCookieKey,
  isSecure,
  newCsrfToken,
  newSession,
  readSession,
  SESSION_COOKIE,
  writeSession,
} from "../src/auth/session.js";

const NOW = 1_800_000_000;
const opts: CookieOpts = {
  key: await deriveCookieKey("s3cret", SESSION_COOKIE, "/admin"),
  prefix: "/admin",
  maxAgeSec: 3600,
  publicOrigin: null,
};
const user = { id: "1", name: "alice" };

function makeApp(o: CookieOpts) {
  const app = new Hono();
  app.get("/write", async (c) => {
    await writeSession(c, o, { u: user, csrf: "tok", iat: NOW });
    return c.text("ok");
  });
  app.get("/clear", (c) => {
    clearSession(c, o);
    return c.text("ok");
  });
  app.get("/read", async (c) => c.json(await readSession(c, o, NOW)));
  // Signs an arbitrary raw value, to build malformed or wrongly shaped cookies.
  app.get("/raw", async (c) => {
    await setSignedCookie(
      c,
      SESSION_COOKIE,
      c.req.query("v") ?? "",
      c.req.query("secret") === undefined
        ? o.key
        : await deriveCookieKey(c.req.query("secret") as string, SESSION_COOKIE, o.prefix),
    );
    return c.text("ok");
  });
  return app;
}

function cookieHeader(res: Response): string {
  return res.headers.get("set-cookie") ?? "";
}

function cookiePair(res: Response): string {
  return cookieHeader(res).split(";")[0] as string;
}

async function readWith(app: Hono, cookie: string): Promise<unknown> {
  const res = await app.request("http://localhost/read", { headers: { cookie } });
  return res.json();
}

async function signedRaw(app: Hono, v: string, secret?: string): Promise<string> {
  const q = new URLSearchParams({ v });
  if (secret) q.set("secret", secret);
  return cookiePair(await app.request(`http://localhost/raw?${q}`));
}

describe("deriveCookieKey (decision 042)", () => {
  it("returns 32 bytes", async () => {
    expect((await deriveCookieKey("s3cret", SESSION_COOKIE, "/admin")).byteLength).toBe(32);
  });

  it("is deterministic", async () => {
    const a = new Uint8Array(await deriveCookieKey("s3cret", SESSION_COOKIE, "/admin"));
    const b = new Uint8Array(await deriveCookieKey("s3cret", SESSION_COOKIE, "/admin"));
    expect(b).toEqual(a);
  });

  it.each([
    ["cookie name", ["da_session", "/a"], ["da_flash", "/a"]],
    ["prefix /a vs /b", ["da_session", "/a"], ["da_session", "/b"]],
    ["prefix /a vs empty", ["da_session", "/a"], ["da_session", ""]],
    ["prefix /b vs empty", ["da_session", "/b"], ["da_session", ""]],
  ] as const)("differs by %s", async (_label, [nameA, prefixA], [nameB, prefixB]) => {
    const a = new Uint8Array(await deriveCookieKey("s3cret", nameA, prefixA));
    const b = new Uint8Array(await deriveCookieKey("s3cret", nameB, prefixB));
    expect(b).not.toEqual(a);
  });
});

describe("session round trip", () => {
  const app = makeApp(opts);

  it("reads back what was written", async () => {
    const cookie = cookiePair(await app.request("http://localhost/write"));
    expect(await readWith(app, cookie)).toEqual({ u: user, csrf: "tok", iat: NOW });
  });

  it("stores only the keys u, csrf and iat", async () => {
    const cookie = cookiePair(await app.request("http://localhost/write"));
    const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
    const json = value.slice(0, value.lastIndexOf("."));
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(["csrf", "iat", "u"]);
  });

  it("round trips a null user", async () => {
    const a = new Hono();
    a.get("/w", async (c) => {
      await writeSession(c, opts, { u: null, csrf: "x", iat: NOW });
      return c.text("ok");
    });
    a.get("/r", async (c) => c.json(await readSession(c, opts, NOW)));
    const cookie = cookiePair(await a.request("http://localhost/w"));
    const res = await a.request("http://localhost/r", { headers: { cookie } });
    expect(await res.json()).toEqual({ u: null, csrf: "x", iat: NOW });
  });

  it("returns null without a cookie", async () => {
    expect(await readWith(app, "")).toBeNull();
  });

  it("returns null for a tampered value", async () => {
    const cookie = cookiePair(await app.request("http://localhost/write"));
    const tampered = cookie.replace("alice", "mallory");
    expect(tampered).not.toBe(cookie);
    expect(await readWith(app, tampered)).toBeNull();
  });

  it("returns null for a cookie signed with another secret", async () => {
    const v = JSON.stringify({ u: null, csrf: "x", iat: NOW });
    expect(await readWith(app, await signedRaw(app, v, "other"))).toBeNull();
  });

  it("returns null for a cookie signed with the raw secret (pre-042 format)", async () => {
    const a = new Hono();
    a.get("/raw", async (c) => {
      await setSignedCookie(
        c,
        SESSION_COOKIE,
        JSON.stringify({ u: null, csrf: "x", iat: NOW }),
        "s3cret",
      );
      return c.text("ok");
    });
    const cookie = cookiePair(await a.request("http://localhost/raw"));
    expect(await readWith(app, cookie)).toBeNull();
  });

  it("returns null for malformed JSON", async () => {
    expect(await readWith(app, await signedRaw(app, "{not json"))).toBeNull();
  });

  it.each([
    ["non-object", "[1]"],
    ["missing csrf", JSON.stringify({ u: null, iat: NOW })],
    ["empty csrf", JSON.stringify({ u: null, csrf: "", iat: NOW })],
    ["numeric csrf", JSON.stringify({ u: null, csrf: 1, iat: NOW })],
    ["string iat", JSON.stringify({ u: null, csrf: "x", iat: "1" })],
    ["missing iat", JSON.stringify({ u: null, csrf: "x" })],
    ["undefined u", JSON.stringify({ csrf: "x", iat: NOW })],
    ["u without name", JSON.stringify({ u: { id: "1" }, csrf: "x", iat: NOW })],
    ["u with numeric id", JSON.stringify({ u: { id: 1, name: "a" }, csrf: "x", iat: NOW })],
  ])("returns null for a wrong shape (%s)", async (_label, v) => {
    expect(await readWith(app, await signedRaw(app, v))).toBeNull();
  });

  it("returns null once older than maxAgeSec, but not at the boundary", async () => {
    const at = async (iat: number) =>
      readWith(app, await signedRaw(app, JSON.stringify({ u: null, csrf: "x", iat })));
    expect(await at(NOW - 3600)).not.toBeNull();
    expect(await at(NOW - 3601)).toBeNull();
  });

  it("returns null when iat is more than 60 s in the future, but not at 60 s", async () => {
    const at = async (iat: number) =>
      readWith(app, await signedRaw(app, JSON.stringify({ u: null, csrf: "x", iat })));
    expect(await at(NOW + 60)).not.toBeNull();
    expect(await at(NOW + 61)).toBeNull();
  });
});

describe("newSession / newCsrfToken", () => {
  it("newCsrfToken is 43 base64url characters and random", () => {
    const t = newCsrfToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newCsrfToken()).not.toBe(t);
  });

  it("newSession carries the user, a fresh csrf and iat", () => {
    const s = newSession(user, NOW);
    expect(s.u).toEqual(user);
    expect(s.iat).toBe(NOW);
    expect(s.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSession(null, NOW).u).toBeNull();
  });
});

describe("session cookie attributes", () => {
  it("sets HttpOnly, SameSite=Lax, Path=<prefix> and Max-Age", async () => {
    const h = cookieHeader(await makeApp(opts).request("http://localhost/write"));
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Lax");
    expect(h).toContain("Path=/admin");
    expect(h).toContain("Max-Age=3600");
  });

  it("uses Path=/ when the prefix is empty", async () => {
    const h = cookieHeader(
      await makeApp({ ...opts, prefix: "" }).request("http://localhost/write"),
    );
    expect(h).toContain("Path=/;");
  });

  it.each([
    [null, "http://localhost/write", false],
    [null, "https://localhost/write", true],
    ["https://admin.example.com", "http://localhost/write", true],
    ["http://admin.example.com", "https://localhost/write", false],
  ])("Secure flag: publicOrigin=%s url=%s -> %s", async (publicOrigin, url, secure) => {
    const h = cookieHeader(await makeApp({ ...opts, publicOrigin }).request(url));
    expect(/;\s*Secure/i.test(h)).toBe(secure);
  });
});

describe("clearSession cookie attributes", () => {
  it.each([
    [null, "http://localhost/clear", false],
    [null, "https://localhost/clear", true],
    ["https://admin.example.com", "http://localhost/clear", true],
    ["http://admin.example.com", "https://localhost/clear", false],
  ])("publicOrigin=%s url=%s -> Secure %s", async (publicOrigin, url, secure) => {
    const h = cookieHeader(await makeApp({ ...opts, publicOrigin }).request(url));
    expect(h).toContain(`${SESSION_COOKIE}=;`);
    expect(h).toContain("Max-Age=0");
    expect(h).toContain("Path=/admin");
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Lax");
    expect(/;\s*Secure/i.test(h)).toBe(secure);
  });
});

describe("isSecure", () => {
  it("follows the same table", () => {
    const ctx = (url: string) => ({ req: { url } }) as never;
    expect(isSecure(ctx("http://x/"), null)).toBe(false);
    expect(isSecure(ctx("https://x/"), null)).toBe(true);
    expect(isSecure(ctx("http://x/"), "https://a.example")).toBe(true);
    expect(isSecure(ctx("https://x/"), "http://a.example")).toBe(false);
  });
});
