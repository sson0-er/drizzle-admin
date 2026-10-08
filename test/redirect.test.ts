import { describe, expect, it } from "vitest";
import { externalLoginUrl, loginRedirectUrl, safeNext } from "../src/auth/redirect.js";

describe.each(["/admin", ""])("safeNext with prefix %j", (prefix) => {
  // Templates use P for the prefix so every case runs for both prefixes.
  const p = (s: string) => s.replaceAll("P", prefix);
  const fallback = `${prefix}/`;

  it.each([
    ["the prefix root", "P/", "P/"],
    ["a list URL with a query", "P/authors/?q=x", "P/authors/?q=x"],
    ["a decoded space", "P/kv/a%20b/change/", "P/kv/a%20b/change/"],
    ["an encoded slash", "P/a%2Fb/", "P/a%2Fb/"],
    ["an encoded slash pair", "P/a%2F%2Fb/", "P/a%2F%2Fb/"],
    ["// in the query", "P/x/?q=//evil", "P/x/?q=//evil"],
    ["a dropped fragment", "P/a/#frag", "P/a/"],
    ["a dot segment, normalized", "P/./x", "P/x"],
    ["a dot-dot segment under the prefix, normalized", "P/a/../b/", "P/b/"],
    ["an encoded dot segment, normalized", "P/%2e/x", "P/x"],
  ])("accepts %s", (_name, input, expected) => {
    expect(safeNext(p(input), prefix)).toBe(p(expected));
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash after slash", "/\\evil.example"],
    ["tab-obfuscated", "/\t/evil.example"],
    ["encoded tab", "/%09/evil.example"],
    ["absolute URL", "https://evil.example"],
    ["encoded protocol-relative without slash", "%2F%2Fevil.example"],
    ["NUL", "P/\u0000"],
    ["DEL", "P/\u007f"],
    ["tab", "P/\tx"],
    ["LF", "P/\nx"],
    ["CR", "P/\rx"],
    ["space", "P/a b/"],
    ["no-break space", "P/\u00a0x"],
    ["literal backslash", "P/\\x"],
    ["raw // in the path", "P//evil.example"],
    ["encoded backslash", "P/a%5Cb/"],
    ["encoded tab", "P/a%09b/"],
    ["encoded NUL", "P/a%00b/"],
    ["encoded DEL", "P/a%7Fb/"],
    ["encoded dot segments before an encoded slash", "P/..%2Fx"],
    ["encoded dots and slash", "P/%2e%2e%2fx"],
    ["encoded dot segment in the middle", "P/a%2F..%2Fb/"],
    ["encoded current-directory segment", "P/.%2Fx"],
    ["malformed percent escape", "P/%E0%A4%A"],
    ["invalid percent escape", "P/%zz"],
  ])("rejects %s", (_name, input) => {
    expect(safeNext(p(input), prefix)).toBe(fallback);
  });

  it.each([undefined, null, ""])("rejects %j", (input) => {
    expect(safeNext(input, prefix)).toBe(fallback);
  });
});

describe("safeNext prefix boundary", () => {
  it.each([
    ["other prefix", "/other/"],
    ["prefix without trailing slash", "/admin"],
    ["prefix lookalike", "/administrator/"],
    ["dot segments leaving the prefix", "/admin/../x"],
    ["encoded dot segments leaving the prefix", "/admin/%2e%2e/x"],
    ["encoded protocol-relative after slash", "/%2F%2Fevil.example"],
  ])("rejects %s under /admin", (_name, input) => {
    expect(safeNext(input, "/admin")).toBe("/admin/");
  });

  it("keeps targets that stay inside the empty prefix", () => {
    expect(safeNext("/other/", "")).toBe("/other/");
    expect(safeNext("/admin/../x", "")).toBe("/x");
    expect(safeNext("/admin/%2e%2e/x", "")).toBe("/x");
  });
});

describe("loginRedirectUrl", () => {
  it("encodes the current path and query into next", () => {
    expect(loginRedirectUrl("/admin", "/admin/authors/?q=a")).toBe(
      "/admin/login/?next=%2Fadmin%2Fauthors%2F%3Fq%3Da",
    );
  });
});

describe("externalLoginUrl", () => {
  it("uses ? when the login URL has no query", () => {
    expect(externalLoginUrl("https://sso.example/login", "/admin/a/?q=1")).toBe(
      "https://sso.example/login?next=%2Fadmin%2Fa%2F%3Fq%3D1",
    );
  });

  it("uses & when the login URL already has a query", () => {
    expect(externalLoginUrl("https://sso.example/login?x=1", "/admin/a/")).toBe(
      "https://sso.example/login?x=1&next=%2Fadmin%2Fa%2F",
    );
  });
});
