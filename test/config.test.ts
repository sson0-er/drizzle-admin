import { describe, expect, it } from "vitest";
import { createAdmin, resolveConfig } from "../src/admin.js";
import type { AdminConfig } from "../src/types.js";

const base: AdminConfig = {
  db: {},
  dialect: "sqlite",
  basePath: "/admin",
  secret: "s".repeat(32),
  auth: { verifyCredentials: async () => null },
};

const make = (over: Record<string, unknown> = {}) => ({ ...base, ...over }) as AdminConfig;
const resolved = (over: Record<string, unknown> = {}) => resolveConfig(make(over));
const rejects = (over: Record<string, unknown>, option: string) => {
  // Option names are plain identifiers today; escaping keeps the anchor exact if that changes.
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(() => createAdmin(make(over))).toThrow(new RegExp(`^drizzle-admin: .*${escaped}`));
};

describe("createAdmin", () => {
  it("returns an Admin with register, app and fetch", () => {
    const admin = createAdmin(base);
    expect(typeof admin.register).toBe("function");
    expect(typeof admin.fetch).toBe("function");
    expect("app" in admin).toBe(true);
  });

  it("db: accepts an object, rejects null, undefined and non-objects", () => {
    expect(() => createAdmin(base)).not.toThrow();
    for (const db of [null, undefined, "db", 1]) rejects({ db }, "db");
  });

  it("dialect: accepts sqlite and postgres, rejects others", () => {
    expect(resolved({ dialect: "sqlite" }).dialect).toBe("sqlite");
    expect(resolved({ dialect: "postgres" }).dialect).toBe("postgres");
    rejects({ dialect: "mysql" }, "dialect");
    rejects({ dialect: undefined }, "dialect");
  });

  it("secret: accepts 32 characters, rejects shorter and non-strings", () => {
    expect(resolved({ secret: "x".repeat(32) }).secret).toBe("x".repeat(32));
    rejects({ secret: "x".repeat(31) }, "secret");
    rejects({ secret: 12345 }, "secret");
  });

  describe("basePath", () => {
    it.each([
      ["/admin", "/admin"],
      ["/admin/", "/admin"],
      ["/", ""],
      ["/a/b/", "/a/b"],
    ])("%s -> prefix %j", (basePath, prefix) => {
      expect(resolved({ basePath }).prefix).toBe(prefix);
    });

    it.each(["admin", "/a?b", "/a#b", "/a\\b", "/a b", "//a", "/a\tb", "", "/a//b"])(
      "rejects %j",
      (basePath) => {
        rejects({ basePath }, "basePath");
      },
    );
  });

  describe("auth", () => {
    it("accepts verifyCredentials only, or getUser only", () => {
      expect(resolved({ auth: { verifyCredentials: async () => null } }).authMode).toBe("builtin");
      expect(resolved({ auth: { getUser: async () => null } }).authMode).toBe("external");
    });

    it("rejects neither function", () => {
      rejects({ auth: {} }, "auth");
      rejects({ auth: { loginUrl: "/login" } }, "auth");
      rejects({ auth: undefined }, "auth");
    });

    it("authMode is external when both are set (getUser wins)", () => {
      const auth = { getUser: async () => null, verifyCredentials: async () => null };
      expect(resolved({ auth }).authMode).toBe("external");
    });
  });

  describe("sessionMaxAgeSec", () => {
    it("defaults to 28800 and accepts a positive integer", () => {
      expect(resolved().sessionMaxAgeSec).toBe(28800);
      expect(resolved({ sessionMaxAgeSec: 60 }).sessionMaxAgeSec).toBe(60);
    });

    it("accepts 400 days", () => {
      expect(resolved({ sessionMaxAgeSec: 34560000 }).sessionMaxAgeSec).toBe(34560000);
    });

    it.each([34560001, 0, 1.5, -1, Number.NaN])("rejects %s", (sessionMaxAgeSec) => {
      expect(() => createAdmin(make({ sessionMaxAgeSec }))).toThrow(
        new Error(
          "drizzle-admin: sessionMaxAgeSec must be a positive integer of at most 34560000 (400 days)",
        ),
      );
    });
  });

  describe("timeZone", () => {
    it("accepts an IANA zone and defaults to the local zone", () => {
      expect(resolved({ timeZone: "Asia/Tokyo" }).timeZone).toBe("Asia/Tokyo");
      expect(resolved().timeZone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
    });

    it("rejects an invalid zone", () => {
      rejects({ timeZone: "Mars/Olympus" }, "timeZone");
    });
  });

  describe("siteTitle", () => {
    it("is null when absent and keeps a given title", () => {
      expect(resolved().siteTitle).toBeNull();
      expect(resolved({ siteTitle: "My Admin" }).siteTitle).toBe("My Admin");
    });
  });

  describe("publicOrigin", () => {
    it.each([
      ["https://a.example", "https://a.example"],
      ["https://a.example/", "https://a.example"],
      ["http://localhost:3000", "http://localhost:3000"],
      ["https://a.example:443", "https://a.example"],
    ])("accepts %s and normalizes to %s", (publicOrigin, origin) => {
      expect(resolved({ publicOrigin }).publicOrigin).toBe(origin);
    });

    it.each([
      "not a url",
      "ftp://a.example",
      "https://a.example/path",
      "https://a.example?x",
      "https://a.example#x",
      "https://a.example/?",
      "https://u:p@a.example",
      "https://u@a.example",
      42,
    ])("rejects %j", (publicOrigin) => {
      rejects({ publicOrigin }, "publicOrigin");
    });

    it("is null when absent", () => {
      expect(resolved().publicOrigin).toBeNull();
    });
  });

  it("normalizes into the AdminState config shape", () => {
    const db = {};
    const auth = { getUser: async () => null };
    expect(resolved({ db, auth, basePath: "/x/" })).toEqual({
      db,
      dialect: "sqlite",
      prefix: "/x",
      siteTitle: null,
      secret: base.secret,
      sessionMaxAgeSec: 28800,
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      authMode: "external",
      auth,
      publicOrigin: null,
    });
  });
});
