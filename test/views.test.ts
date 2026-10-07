import { describe, expect, it } from "vitest";
import { ADMIN_CSS, ADMIN_CSS_VERSION } from "../src/static/admin-css.js";
import { SELECT_ALL_SCRIPT } from "../src/static/select-all.js";
import { sortHref, withQuery } from "../src/views/url.js";

const BASE = "/admin/authors/";
const qs = (s: string) => new URLSearchParams(s);

describe("withQuery", () => {
  it("preserves other params and applies changes", () => {
    expect(withQuery(BASE, qs("q=bob&f_role=admin"), { o: "name" })).toBe(
      `${BASE}?q=bob&f_role=admin&o=name`,
    );
  });

  it("deletes a param when the change is null", () => {
    expect(withQuery(BASE, qs("q=bob&o=name"), { q: null })).toBe(`${BASE}?o=name`);
  });

  it("drops p unless p is in the changes", () => {
    expect(withQuery(BASE, qs("q=bob&p=3"), { o: "name" })).toBe(`${BASE}?q=bob&o=name`);
    expect(withQuery(BASE, qs("q=bob&p=3"), { p: "4" })).toBe(`${BASE}?q=bob&p=4`);
  });

  it("returns only base for an empty query", () => {
    expect(withQuery(BASE, qs(""), {})).toBe(BASE);
    expect(withQuery(BASE, qs("p=2"), {})).toBe(BASE);
    expect(withQuery(BASE, qs("o=name"), { o: null })).toBe(BASE);
  });

  it("does not mutate the current params", () => {
    const current = qs("q=a&p=2");
    withQuery(BASE, current, { q: null });
    expect(current.toString()).toBe("q=a&p=2");
  });
});

describe("sortHref", () => {
  const current = qs("q=bob&o=-id.name&p=2&f_role=admin");
  const oOf = (href: string) => new URL(href, "http://x").searchParams.get("o");

  it("cycles none -> asc -> desc -> none", () => {
    const first = sortHref(BASE, qs("q=bob"), "name", "none");
    expect(first).toBe(`${BASE}?q=bob&o=name`);
    const second = sortHref(BASE, qs(new URL(first, "http://x").search), "name", "asc");
    expect(second).toBe(`${BASE}?q=bob&o=-name`);
    const third = sortHref(BASE, qs(new URL(second, "http://x").search), "name", "desc");
    expect(third).toBe(`${BASE}?q=bob`);
  });

  it("drops other sort keys and p, keeping other params", () => {
    for (const state of ["none", "asc", "desc"] as const) {
      const href = sortHref(BASE, current, "name", state);
      expect(href).not.toContain("p=");
      expect(href).not.toContain("id");
      expect(href).toContain("q=bob");
      expect(href).toContain("f_role=admin");
    }
    expect(oOf(sortHref(BASE, current, "name", "none"))).toBe("name");
    expect(oOf(sortHref(BASE, current, "name", "asc"))).toBe("-name");
    expect(oOf(sortHref(BASE, current, "name", "desc"))).toBeNull();
  });
});

describe("static modules", () => {
  it("SELECT_ALL_SCRIPT has no characters that Hono JSX would escape", () => {
    for (const ch of ["&", "<", ">", '"', "'"]) {
      expect(SELECT_ALL_SCRIPT).not.toContain(ch);
    }
  });

  it("ADMIN_CSS has no external resources", () => {
    expect(ADMIN_CSS).not.toContain("url(http");
    expect(ADMIN_CSS).not.toContain("@import");
  });

  it("ADMIN_CSS styles the required areas", () => {
    for (const needle of [
      "#changelist-filter",
      ".results",
      "overflow-x: auto",
      ".errornote",
      ".errorlist",
      ".messagelist .success",
      ".messagelist .warning",
      ".messagelist .error",
      ":root",
    ]) {
      expect(ADMIN_CSS).toContain(needle);
    }
  });

  it("ADMIN_CSS_VERSION is 8 hex chars", () => {
    expect(ADMIN_CSS_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });
});
