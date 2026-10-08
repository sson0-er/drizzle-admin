import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE, readLocale } from "../src/auth/locale.js";

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
