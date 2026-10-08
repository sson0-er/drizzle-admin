import { Hono } from "hono";
import { setSignedCookie } from "hono/cookie";
import { describe, expect, it } from "vitest";
import {
  addFlash,
  consumeFlash,
  FLASH_COOKIE,
  type FlashMessage,
  type FlashOpts,
} from "../src/auth/flash.js";

const opts: FlashOpts = { secret: "s3cret", prefix: "/admin", publicOrigin: null };

function makeApp(o: FlashOpts) {
  const app = new Hono();
  app.get("/add2", async (c) => {
    await addFlash(c, o, [{ level: "success", text: "one" }]);
    await addFlash(c, o, [
      { level: "warning", text: "two" },
      { level: "error", text: "three" },
    ]);
    return c.text("ok");
  });
  app.get("/add1", async (c) => {
    await addFlash(c, o, [{ level: "success", text: "one" }]);
    return c.text("ok");
  });
  app.get("/consume", async (c) => c.json(await consumeFlash(c, o)));
  app.get("/raw", async (c) => {
    await setSignedCookie(c, FLASH_COOKIE, c.req.query("v") ?? "", o.secret);
    return c.text("ok");
  });
  return app;
}

// A browser keeps the last Set-Cookie for a name, so that is the one that must hold every message.
const pair = (res: Response) => (res.headers.getSetCookie().at(-1) ?? "").split(";")[0] as string;

async function consume(app: Hono, cookie: string) {
  const res = await app.request("http://localhost/consume", { headers: { cookie } });
  return { res, body: (await res.json()) as FlashMessage[] };
}

// An invalid cookie must be removed, or it would be re-sent and re-rejected until it expires.
const expectDeleted = (res: Response) => {
  const h = res.headers.get("set-cookie") ?? "";
  expect(h).toContain(`${FLASH_COOKIE}=;`);
  expect(h).toContain("Max-Age=0");
};

describe("flash", () => {
  const app = makeApp(opts);

  it("two addFlash calls in one response keep both messages", async () => {
    const res = await app.request("http://localhost/add2");
    const { body } = await consume(app, pair(res));
    expect(body).toEqual([
      { level: "success", text: "one" },
      { level: "warning", text: "two" },
      { level: "error", text: "three" },
    ]);
  });

  it("consumeFlash returns the stored message", async () => {
    const cookie = pair(await app.request("http://localhost/add1"));
    const { body } = await consume(app, cookie);
    expect(body).toEqual([{ level: "success", text: "one" }]);
  });

  it("returns [] without a cookie", async () => {
    const { body } = await consume(app, "");
    expect(body).toEqual([]);
  });

  it("returns [] for a tampered cookie", async () => {
    const original = pair(await app.request("http://localhost/add1"));
    const cookie = original.replace("one", "evil");
    expect(cookie).not.toBe(original); // guards against the replace silently not matching
    const { res, body } = await consume(app, cookie);
    expect(body).toEqual([]);
    expectDeleted(res);
  });

  it("returns [] for a cookie signed with another secret", async () => {
    const other = makeApp({ ...opts, secret: "other" });
    const cookie = pair(await other.request("http://localhost/add1"));
    const { res, body } = await consume(app, cookie);
    expect(body).toEqual([]);
    expectDeleted(res);
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["not an array", JSON.stringify({ level: "success", text: "x" })],
    ["unknown level", JSON.stringify([{ level: "info", text: "x" }])],
    ["non-string text", JSON.stringify([{ level: "success", text: 1 }])],
    ["null entry", JSON.stringify([null])],
  ])("returns [] for an invalid shape (%s)", async (_label, v) => {
    const cookie = pair(await app.request(`http://localhost/raw?v=${encodeURIComponent(v)}`));
    const { res, body } = await consume(app, cookie);
    expect(body).toEqual([]);
    expectDeleted(res);
  });

  it("sets HttpOnly, SameSite=Lax, Path and Max-Age=60", async () => {
    const h = (await app.request("http://localhost/add1")).headers.get("set-cookie") ?? "";
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Lax");
    expect(h).toContain("Path=/admin");
    expect(h).toContain("Max-Age=60");
  });

  it("uses Path=/ when the prefix is empty", async () => {
    const a = makeApp({ ...opts, prefix: "" });
    const h = (await a.request("http://localhost/add1")).headers.get("set-cookie") ?? "";
    expect(h).toContain("Path=/;");
  });

  it.each([
    [null, "http://localhost/add1", false],
    [null, "https://localhost/add1", true],
    ["https://admin.example.com", "http://localhost/add1", true],
    ["http://admin.example.com", "https://localhost/add1", false],
  ])("Secure flag: publicOrigin=%s url=%s -> %s", async (publicOrigin, url, secure) => {
    const h = (await makeApp({ ...opts, publicOrigin }).request(url)).headers.get("set-cookie");
    expect(/;\s*Secure/i.test(h ?? "")).toBe(secure);
  });
});

describe("consumeFlash deletion header", () => {
  it.each([
    [null, "http://localhost/consume", false],
    [null, "https://localhost/consume", true],
    ["https://admin.example.com", "http://localhost/consume", true],
    ["http://admin.example.com", "https://localhost/consume", false],
  ])("publicOrigin=%s url=%s -> Secure %s", async (publicOrigin, url, secure) => {
    const cookie = pair(await makeApp(opts).request("http://localhost/add1"));
    const res = await makeApp({ ...opts, publicOrigin }).request(url, { headers: { cookie } });
    const h = res.headers.get("set-cookie") ?? "";
    expect(h).toContain(`${FLASH_COOKIE}=;`);
    expect(h).toContain("Max-Age=0");
    expect(h).toContain("Path=/admin");
    expect(h).toContain("HttpOnly");
    expect(h).toContain("SameSite=Lax");
    expect(/;\s*Secure/i.test(h)).toBe(secure);
  });
});
