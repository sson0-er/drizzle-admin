import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type Locale, MESSAGES } from "../src/messages.js";
import {
  type Client,
  createClient,
  makeAdmin,
  type Overrides,
  type TestAdmin,
} from "./helpers/app.js";
import { dialects } from "./helpers/db.js";
import { attr, type Node, parse, qs, qsa, text } from "./helpers/html.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const models: NonNullable<Overrides["models"]> = {
  authors: {
    label: "Writers",
    toString: (row) => String(row.name),
    actions: [{ name: "promote", label: "Promote", run: async () => {} }],
  },
  articles: { listFilter: ["publishedAt"] },
  kv: {
    searchFields: ["value"],
    formatters: {
      value: () => {
        throw new Error("formatter-exploded");
      },
    },
  },
};

const docOf = async (res: Response): Promise<Node> => parse(await res.text());

const htmlLang = (doc: Node): string | null => {
  const html = qs(doc, { tag: "html" });
  return html === null ? null : attr(html, "lang");
};

const titleOf = (doc: Node): string => text(qs(doc, { tag: "title" }) as Node);

const titleSuffix = {
  en: "| Site administration",
  ja: `| ${MESSAGES.ja.defaultSiteTitle}`,
} as const;

describe.each(dialects)("i18n ($name)", (fixture) => {
  // `a` is read-only; `w` takes writes and has its own site title.
  let a: TestAdmin;
  let w: TestAdmin;
  beforeAll(async () => {
    a = await makeAdmin(fixture, { models });
    w = await makeAdmin(fixture, { models, config: { siteTitle: "My Admin" } });
  });
  afterAll(async () => {
    await a.close();
    await w.close();
  });

  /** A logged-in (or anonymous) client with the given `da_lang` value, if any. */
  const clientFor = async (t: TestAdmin, lang?: string, loggedIn = true): Promise<Client> => {
    const client = createClient((req) => t.admin.fetch(req));
    if (loggedIn) await client.login();
    if (lang !== undefined) client.setCookie("da_lang", lang);
    return client;
  };

  const sets = (res: Response) =>
    res.headers.getSetCookie().filter((c) => c.startsWith("da_lang="));

  it.each([
    { name: "no da_lang cookie", lang: undefined },
    { name: "an unknown da_lang value", lang: "fr" },
  ])("serves English for $name and does not write the cookie", async ({ lang }) => {
    const res = await (await clientFor(a, lang)).get("/admin/");
    expect(res.status).toBe(200);
    expect(sets(res)).toEqual([]);
    const doc = await docOf(res);
    expect(htmlLang(doc)).toBe("en");
    const nav = qs(doc, { tag: "nav", cls: "breadcrumbs" }) as Node;
    expect(text(nav).trim()).toBe(MESSAGES.en.home);
    expect(titleOf(doc).endsWith(titleSuffix.en)).toBe(true);
  });

  describe("with da_lang=ja", () => {
    const pages: { name: string; check: (client: Client) => Promise<void> }[] = [
      {
        name: "the dashboard",
        check: async (client) => {
          const doc = await docOf(await client.get("/admin/"));
          expect(htmlLang(doc)).toBe("ja");
          expect(text(qs(doc, { tag: "nav", cls: "breadcrumbs" }) as Node).trim()).toBe(
            MESSAGES.ja.home,
          );
          expect(titleOf(doc).endsWith(titleSuffix.ja)).toBe(true);
        },
      },
      {
        name: "a list with its result count",
        check: async (client) => {
          const doc = await docOf(await client.get("/admin/authors/"));
          expect(htmlLang(doc)).toBe("ja");
          const count = qs(doc, { tag: "span", cls: "result-count" }) as Node;
          expect(text(count)).toBe(MESSAGES.ja.resultCount(4));
        },
      },
      {
        name: "the date presets of a list filter",
        check: async (client) => {
          const doc = await docOf(await client.get("/admin/articles/"));
          const box = qs(doc, { tag: "div", attrs: { "data-filter": "publishedAt" } }) as Node;
          expect(qsa(box, { tag: "a" }).map((link) => text(link).trim())).toEqual([
            MESSAGES.ja.all,
            MESSAGES.ja.today,
            MESSAGES.ja.past7,
            MESSAGES.ja.thisMonth,
            MESSAGES.ja.thisYear,
          ]);
        },
      },
      {
        name: "a 400 add form",
        check: async (client) => {
          const res = await client.post("/admin/authors/add/", { name: "" });
          expect(res.status).toBe(400);
          const doc = await docOf(res);
          expect(htmlLang(doc)).toBe("ja");
          expect(text(qs(doc, { tag: "ul", cls: "errorlist" }) as Node)).toContain(
            MESSAGES.ja.required,
          );
          expect(text(qs(doc, { tag: "p", cls: "errornote" }) as Node)).toBe(
            MESSAGES.ja.formHasErrors,
          );
        },
      },
      {
        name: "a 404 page",
        check: async (client) => {
          const res = await client.get("/admin/nosuch/");
          expect(res.status).toBe(404);
          const doc = await docOf(res);
          expect(htmlLang(doc)).toBe("ja");
          expect(text(qs(doc, { tag: "p", cls: "error-message" }) as Node)).toBe(
            MESSAGES.ja.notFound,
          );
        },
      },
    ];

    it.each(pages)("renders $name in Japanese", async ({ check }) => {
      await check(await clientFor(a, "ja"));
    });

    it("renders the flash after a successful add in Japanese", async () => {
      const client = await clientFor(w, "ja");
      const res = await client.post("/admin/authors/add/", { name: "flash-ja" });
      expect(res.status).toBe(303);
      const doc = await docOf(await client.get(res.headers.get("Location") ?? ""));
      const items = qsa(qs(doc, { tag: "ul", cls: "messagelist" }) as Node, { tag: "li" });
      expect(items.map((li) => text(li).trim())).toEqual([MESSAGES.ja.added("flash-ja")]);
    });

    it("renders the login page in Japanese when logged out", async () => {
      const res = await (await clientFor(a, "ja", false)).get("/admin/login/");
      expect(res.status).toBe(200);
      const doc = await docOf(res);
      expect(htmlLang(doc)).toBe("ja");
      expect(text(qs(doc, { tag: "label", attrs: { for: "id_username" } }) as Node)).toBe(
        MESSAGES.ja.username,
      );
      expect(text(qs(doc, { tag: "label", attrs: { for: "id_password" } }) as Node)).toBe(
        MESSAGES.ja.password,
      );
      const form = qs(doc, { tag: "form", id: "login-form" }) as Node;
      expect(text(qs(form, { tag: "button" }) as Node)).toBe(MESSAGES.ja.login);
    });
  });

  describe.each(["en", "ja"] as const)("user-provided texts in %s", (locale: Locale) => {
    it("shows the configured site title, model label and action label unchanged", async () => {
      const client = await clientFor(w, locale);
      const dashboard = await docOf(await client.get("/admin/"));
      expect(titleOf(dashboard).endsWith("| My Admin")).toBe(true);
      const row = qs(dashboard, { tag: "tr", attrs: { "data-model": "authors" } }) as Node;
      expect(text(qs(row, { tag: "th" }) as Node)).toBe("Writers");
      const list = await docOf(await client.get("/admin/authors/"));
      const select = qs(list, { tag: "select", attrs: { name: "action" } }) as Node;
      expect(qsa(select, { tag: "option" }).map((o) => text(o))).toContain("Promote");
    });
  });

  describe("minimal pages with da_lang=ja", () => {
    it("shows the Origin check failure in Japanese", async () => {
      const client = await clientFor(a, "ja");
      const res = await client.post(
        "/admin/authors/",
        {},
        { headers: { Origin: "http://evil.example" } },
      );
      expect(res.status).toBe(403);
      const doc = await docOf(res);
      expect(htmlLang(doc)).toBe("ja");
      expect(text(qs(doc, { tag: "p", cls: "error-message" }) as Node)).toBe(
        MESSAGES.ja.csrfFailed,
      );
    });

    it("shows a 500 in Japanese and keeps the log prefix in English", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await (await clientFor(a, "ja")).get("/admin/kv/");
      expect(res.status).toBe(500);
      const doc = await docOf(res);
      expect(htmlLang(doc)).toBe("ja");
      expect(text(qs(doc, { tag: "p", cls: "error-message" }) as Node)).toBe(
        MESSAGES.ja.serverError,
      );
      expect(spy.mock.calls.map((call) => call[0])).toEqual(["drizzle-admin:"]);
    });
  });
});
