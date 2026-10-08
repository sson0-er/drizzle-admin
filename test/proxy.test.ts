import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Client,
  createClient,
  makeAdmin,
  TEST_PASSWORD,
  TEST_USER,
  type TestAdmin,
} from "./helpers/app.js";
import { dialects } from "./helpers/db.js";

const PUBLIC = "https://admin.example.com";
const INTERNAL = "http://internal:3000";

const cookieLine = (res: Response, name: string): string =>
  res.headers.getSetCookie().find((line) => line.startsWith(`${name}=`)) ?? "";

describe.each(dialects)("reverse proxy with publicOrigin ($name)", (fixture) => {
  let t: TestAdmin;
  /** Every response seen by a test client, to check the Location headers in one place. */
  const seen: Response[] = [];

  /** A client whose requests reach the admin as `http://internal:3000/...`, like behind a proxy. */
  function proxied(): Client {
    return createClient(async (req) => {
      const url = new URL(req.url);
      const res = await t.admin.fetch(new Request(`${INTERNAL}${url.pathname}${url.search}`, req));
      seen.push(res);
      return res;
    });
  }
  const post = (c: Client, path: string, form: Record<string, string>, origin?: string) =>
    c.post(path, form, { headers: origin === undefined ? {} : { Origin: origin } });

  async function loggedIn(): Promise<Client> {
    const c = proxied();
    await c.get("/admin/login/");
    const res = await post(
      c,
      "/admin/login/",
      { username: TEST_USER.name, password: TEST_PASSWORD },
      PUBLIC,
    );
    expect(res.status).toBe(303);
    return c;
  }

  beforeAll(async () => {
    t = await makeAdmin(fixture, { login: false, config: { publicOrigin: PUBLIC } });
  });
  afterAll(async () => {
    await t.close();
  });

  it("marks the session cookie Secure on a plain-http request", async () => {
    const res = await proxied().get("/admin/login/");
    expect(res.status).toBe(200);
    expect(cookieLine(res, "da_session")).toMatch(/;\s*Secure/i);
  });

  it("marks the flash cookie Secure", async () => {
    const c = await loggedIn();
    const res = await post(c, "/admin/authors/", { action: "delete_selected" }, PUBLIC);
    expect(res.status).toBe(303);
    const flash = cookieLine(res, "da_flash");
    expect(flash).not.toBe("");
    expect(flash).toMatch(/;\s*Secure/i);
  });

  it("accepts a POST from the public Origin with a valid token", async () => {
    const c = await loggedIn();
    const res = await post(c, "/admin/authors/", { action: "delete_selected" }, PUBLIC);
    expect(res.status).toBe(303);
  });

  it("rejects a POST from the internal Origin without Sec-Fetch-Site", async () => {
    const c = await loggedIn();
    const res = await post(c, "/admin/authors/", { action: "delete_selected" }, INTERNAL);
    expect(res.status).toBe(403);
  });

  it("passes the Origin check with Sec-Fetch-Site same-origin and no Origin", async () => {
    const c = await loggedIn();
    const params = new URLSearchParams({ action: "delete_selected", _csrf: c.csrf() });
    const res = await c.request("/admin/authors/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Sec-Fetch-Site": "same-origin",
      },
      body: params.toString(),
    });
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(303);
  });

  it("keeps every Location header path-only", async () => {
    // Also covers a guard redirect and a logout redirect, not only the 303s above.
    const anonymous = proxied();
    const guard = await anonymous.get("/admin/authors/");
    expect(guard.status).toBe(302);
    const c = await loggedIn();
    await post(c, "/admin/authors/", { action: "delete_selected" }, PUBLIC);
    await post(c, "/admin/logout/", {}, PUBLIC);

    const locations = seen
      .map((res) => res.headers.get("Location"))
      .filter((l): l is string => l !== null);
    expect(locations.length).toBeGreaterThan(3);
    for (const l of locations) expect(l.startsWith("/"), l).toBe(true);
    for (const l of locations) expect(l.startsWith("//"), l).toBe(false);
  });
});
