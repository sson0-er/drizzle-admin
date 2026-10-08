import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type Locale, MESSAGES } from "../src/messages.js";
import { SELECT_ALL_SCRIPT_SHA256 } from "../src/static/select-all.js";
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

const switchForm = (doc: Node): Node | null => qs(doc, { tag: "form", cls: "lang-switch" });

const switchNext = (doc: Node): string | null => {
  const form = switchForm(doc);
  const input = form && qs(form, { tag: "input", attrs: { name: "next" } });
  return input === null || input === undefined ? null : attr(input, "value");
};

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

  describe("language switch (POST /admin/_lang/)", () => {
    const NEXT = "/admin/authors/?q=x";

    it("writes the cookie, redirects to next and switches the rendered language back and forth", async () => {
      const client = await clientFor(a);
      await client.get(NEXT);
      const res = await client.post("/admin/_lang/", { lang: "ja", next: NEXT });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe(NEXT);
      expect(sets(res)).toEqual([
        "da_lang=ja; Max-Age=31536000; Path=/admin; HttpOnly; SameSite=Lax",
      ]);
      expect(htmlLang(await docOf(await client.get(NEXT)))).toBe("ja");

      const back = await client.post("/admin/_lang/", { lang: "en", next: NEXT });
      expect(back.status).toBe(303);
      expect(sets(back)).toEqual([
        "da_lang=en; Max-Age=31536000; Path=/admin; HttpOnly; SameSite=Lax",
      ]);
      expect(htmlLang(await docOf(await client.get(NEXT)))).toBe("en");
    });

    const redirects: {
      name: string;
      body: Record<string, string | string[]>;
      to: string;
      cookie?: boolean;
    }[] = [
      { name: "next //evil.example", body: { lang: "ja", next: "//evil.example" }, to: "/admin/" },
      {
        name: "next https://evil.example/",
        body: { lang: "ja", next: "https://evil.example/" },
        to: "/admin/",
      },
      { name: "next /other/", body: { lang: "ja", next: "/other/" }, to: "/admin/" },
      { name: "next /admin/../x", body: { lang: "ja", next: "/admin/../x" }, to: "/admin/" },
      { name: "next /admin/..%2Fx", body: { lang: "ja", next: "/admin/..%2Fx" }, to: "/admin/" },
      { name: "no next", body: { lang: "ja" }, to: "/admin/" },
      { name: "an unknown lang", body: { lang: "fr", next: NEXT }, to: NEXT, cookie: false },
      { name: "an upper-case lang", body: { lang: "JA", next: NEXT }, to: NEXT, cookie: false },
      {
        name: "a repeated lang field",
        body: { lang: ["ja", "en"], next: NEXT },
        to: NEXT,
        cookie: false,
      },
    ];

    it.each(redirects)("redirects to $to for $name", async ({ body, to, cookie = true }) => {
      const client = await clientFor(a);
      await client.get("/admin/");
      const res = await client.post("/admin/_lang/", body);
      expect(res.status).toBe(303);
      const location = res.headers.get("Location") ?? "";
      expect(location).toBe(to);
      expect(location.startsWith("/admin/") && !location.startsWith("//")).toBe(true);
      // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is excluded
      expect(/[\\\s\x00-\x1f\x7f]/.test(location)).toBe(false);
      expect(sets(res).length > 0).toBe(cookie);
    });

    const rejections: {
      name: string;
      form: Record<string, string>;
      withToken: boolean;
      headers: Record<string, string>;
    }[] = [
      { name: "no token", form: {}, withToken: false, headers: {} },
      { name: "a wrong token", form: { _csrf: "wrong" }, withToken: false, headers: {} },
      {
        name: "a foreign Origin",
        form: {},
        withToken: true,
        headers: { Origin: "http://evil.example" },
      },
    ];

    it.each(rejections)(
      "answers 403 and sets no cookie with $name",
      async ({ form, withToken, headers }) => {
        const client = await clientFor(a);
        await client.get("/admin/");
        const res = await client.post(
          "/admin/_lang/",
          { lang: "ja", next: NEXT, ...form },
          { withToken, headers },
        );
        expect(res.status).toBe(403);
        expect(sets(res)).toEqual([]);
      },
    );

    it("redirects to next from the login page when logged out", async () => {
      const client = await clientFor(a, undefined, false);
      const next = "/admin/login/?next=%2Fadmin%2Fauthors%2F";
      await client.get(next);
      const res = await client.post("/admin/_lang/", { lang: "ja", next });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe(next);
      expect(sets(res)).toEqual([
        "da_lang=ja; Max-Age=31536000; Path=/admin; HttpOnly; SameSite=Lax",
      ]);
    });

    it.each([
      { name: "logged in", loggedIn: true, status: 404, location: null },
      {
        name: "logged out",
        loggedIn: false,
        status: 302,
        location: "/admin/login/?next=%2Fadmin%2F_lang%2F",
      },
    ])("answers GET /admin/_lang/ $status when $name", async ({ loggedIn, status, location }) => {
      const res = await (await clientFor(a, undefined, loggedIn)).get("/admin/_lang/");
      expect(res.status).toBe(status);
      expect(res.headers.get("Location")).toBe(location);
    });

    it("keeps the language after logout", async () => {
      const client = await clientFor(a);
      await client.get("/admin/");
      await client.post("/admin/_lang/", { lang: "ja", next: "/admin/" });
      await client.get("/admin/");
      const res = await client.post("/admin/logout/");
      expect(res.status).toBe(303);
      expect(sets(res)).toEqual([]);
      expect(htmlLang(await docOf(await client.get("/admin/login/")))).toBe("ja");
    });

    it("still serves a model registered with the slug lang", async () => {
      const l = await makeAdmin(fixture, { models: { authors: { slug: "lang" } } });
      try {
        expect((await l.client.get("/admin/lang/")).status).toBe(200);
        const res = await l.client.post("/admin/lang/", {
          action: "delete_selected",
          _selected: "1",
        });
        expect(res.status).toBe(200);
      } finally {
        await l.close();
      }
    });
  });

  describe("language switcher on the page", () => {
    const LOGIN_NEXT = "/admin/login/?next=%2Fadmin%2Fauthors%2F";

    it("posts the login page switcher back to the login URL", async () => {
      const client = await clientFor(a, undefined, false);
      const doc = await docOf(await client.get(LOGIN_NEXT));
      expect(switchNext(doc)).toBe(LOGIN_NEXT);
      const form = switchForm(doc) as Node;
      const token = attr(qs(form, { tag: "input", attrs: { name: "_csrf" } }) as Node, "value");
      expect(token).toBe(client.csrf());
      const res = await client.post("/admin/_lang/", { lang: "ja", next: switchNext(doc) ?? "" });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe(LOGIN_NEXT);
    });

    it("keeps the login target in the switcher after a failed login", async () => {
      const client = await clientFor(a, undefined, false);
      await client.get(LOGIN_NEXT);
      const res = await client.post("/admin/login/", {
        username: "nobody",
        password: "wrong",
        next: "/admin/authors/",
      });
      expect(res.status).toBe(400);
      expect(switchNext(await docOf(res))).toBe(LOGIN_NEXT);
    });

    it("offers the switcher on the external 401 page", async () => {
      const e = await makeAdmin(fixture, { config: { auth: { getUser: async () => null } } });
      try {
        const res = await e.client.get("/admin/authors/");
        expect(res.status).toBe(401);
        expect(switchNext(await docOf(res))).toBe("/admin/authors/");
        const posted = await e.client.post("/admin/_lang/", {
          lang: "ja",
          next: "/admin/authors/",
        });
        expect(posted.status).toBe(303);
        expect(posted.headers.get("Location")).toBe("/admin/authors/");
      } finally {
        await e.close();
      }
    });

    it("renders the switcher with the page path and query on a normal page", async () => {
      const client = await clientFor(a, "ja");
      const doc = await docOf(await client.get("/admin/authors/?q=x&p=1"));
      expect(switchNext(doc)).toBe("/admin/authors/?q=x&p=1");
      expect(switchNext(await docOf(await client.get("/admin/")))).toBe("/admin/");
    });

    it("keeps the raw percent-encoded path in the switcher", async () => {
      const client = await clientFor(a);
      const doc = await docOf(await client.get("/admin/authors/?q=%E3%81%82%20b"));
      expect(switchNext(doc)).toBe("/admin/authors/?q=%E3%81%82%20b");
    });

    it("sends the exact builtin CSP on a da_lang=ja page", async () => {
      const res = await (await clientFor(a, "ja")).get("/admin/");
      expect(res.headers.get("Content-Security-Policy")).toBe(
        `default-src 'none'; script-src 'sha256-${SELECT_ALL_SCRIPT_SHA256}'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      );
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
      expect(switchForm(doc)).toBeNull();
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
      expect(switchForm(doc)).toBeNull();
      expect(spy.mock.calls.map((call) => call[0])).toEqual(["drizzle-admin:"]);
    });
  });
});
