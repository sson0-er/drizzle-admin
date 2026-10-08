import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE, readLocale, writeLocale } from "../src/auth/locale.js";

const app = new Hono().get("/", (c) => c.text(readLocale(c)));

describe("readLocale", () => {
  it("reads the unsigned da_lang cookie", () => {
    expect(LOCALE_COOKIE).toBe("da_lang");
  });

  it.each([
    { cookie: undefined, expected: "en" },
    { cookie: "da_lang=ja", expected: "ja" },
    { cookie: "da_lang=en", expected: "en" },
    { cookie: "da_lang=fr", expected: "en" },
    { cookie: "da_lang=JA", expected: "en" },
    { cookie: "da_lang=", expected: "en" },
    { cookie: "da_lang=%E0%A4%A", expected: "en" },
    { cookie: "da_lang=ja; da_lang=en", expected: "ja" },
  ])("gives $expected for the Cookie header $cookie", async ({ cookie, expected }) => {
    const res = await app.request("/", cookie === undefined ? {} : { headers: { Cookie: cookie } });
    expect(await res.text()).toBe(expected);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe("writeLocale", () => {
  const writer = (prefix: string, publicOrigin: string | null) =>
    new Hono().get("/*", (c) => {
      writeLocale(c, { prefix, publicOrigin }, "ja");
      return c.text("ok");
    });

  it.each([
    {
      name: "plain http",
      url: "http://localhost/admin/x",
      prefix: "/admin",
      publicOrigin: null,
      expected: "da_lang=ja; Max-Age=31536000; Path=/admin; HttpOnly; SameSite=Lax",
    },
    {
      name: "https",
      url: "https://localhost/admin/x",
      prefix: "/admin",
      publicOrigin: null,
      expected: "da_lang=ja; Max-Age=31536000; Path=/admin; HttpOnly; Secure; SameSite=Lax",
    },
    {
      name: "http behind an https publicOrigin",
      url: "http://localhost/admin/x",
      prefix: "/admin",
      publicOrigin: "https://admin.example.com",
      expected: "da_lang=ja; Max-Age=31536000; Path=/admin; HttpOnly; Secure; SameSite=Lax",
    },
    {
      name: "an empty prefix",
      url: "http://localhost/x",
      prefix: "",
      publicOrigin: null,
      expected: "da_lang=ja; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax",
    },
  ])("sets the cookie for $name", async ({ url, prefix, publicOrigin, expected }) => {
    const res = await writer(prefix, publicOrigin).request(url);
    expect(res.headers.getSetCookie()).toEqual([expected]);
  });
});
