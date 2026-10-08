import { describe, expect, it } from "vitest";
import { messages } from "../src/messages.js";
import { ADMIN_CSS, ADMIN_CSS_VERSION } from "../src/static/admin-css.js";
import { SELECT_ALL_SCRIPT } from "../src/static/select-all.js";
import { DashboardPage } from "../src/views/dashboard.js";
import { ErrorPage } from "../src/views/error.js";
import { Layout, type PageChrome } from "../src/views/layout.js";
import { ListPage, type ListPageProps } from "../src/views/list.js";
import { LoginPage } from "../src/views/login.js";
import { sortHref, withQuery } from "../src/views/url.js";
import { attr, parse, qs as q1, qsa, text } from "./helpers/html.js";

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

  // The text of the first top-level `@media <query>` block, found by balancing braces.
  const mediaBlock = (query: string): string => {
    const start = ADMIN_CSS.indexOf(`@media (${query})`);
    expect(start, query).toBeGreaterThanOrEqual(0);
    const open = ADMIN_CSS.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < ADMIN_CSS.length; i++) {
      if (ADMIN_CSS[i] === "{") depth++;
      else if (ADMIN_CSS[i] === "}" && --depth === 0) return ADMIN_CSS.slice(open + 1, i);
    }
    throw new Error(`unbalanced @media block ${query}`);
  };

  it("ADMIN_CSS redefines custom properties in the dark color scheme", () => {
    const dark = mediaBlock("prefers-color-scheme: dark");
    expect(dark).toContain(":root");
    expect(dark).toMatch(/--[a-z-]+:\s*#/);
  });

  it("ADMIN_CSS moves the filter above the table on narrow screens", () => {
    const narrow = mediaBlock("max-width: 767px");
    expect(narrow).toContain("#changelist-filter");
    expect(narrow).toMatch(/#changelist-filter\s*\{[^}]*order:\s*-1/);
    expect(narrow).not.toMatch(/float:\s*right/);
    expect(ADMIN_CSS).toContain("overflow-x: auto");
  });

  it("ADMIN_CSS_VERSION is 8 hex chars", () => {
    expect(ADMIN_CSS_VERSION).toMatch(/^[0-9a-f]{8}$/);
  });
});

const chrome: PageChrome = {
  siteTitle: "Site",
  prefix: "/admin",
  title: "Authors",
  user: { id: "1", name: "alice" },
  showLogout: true,
  csrfToken: "tok<en",
  flash: [],
  breadcrumbs: [{ label: messages.home, href: "/admin/" }, { label: "Authors" }],
};

describe("Layout", () => {
  const render = (over: Partial<PageChrome> = {}) =>
    parse(String(Layout({ ...chrome, ...over, children: "body" })));

  it("renders the document skeleton and stylesheet link", () => {
    const doc = render();
    expect(qsa(doc, { tag: "html", attrs: { lang: "ja" } })).toHaveLength(1);
    const link = q1(doc, { tag: "link", attrs: { rel: "stylesheet" } });
    expect(link && attr(link, "href")).toBe(`/admin/static/admin.css?v=${ADMIN_CSS_VERSION}`);
    const title = q1(doc, { tag: "title" });
    expect(title && text(title)).toBe("Authors | Site");
    expect(qsa(doc, { tag: "header", id: "header" })).toHaveLength(1);
    expect(qsa(doc, { tag: "main", id: "content" })).toHaveLength(1);
  });

  it("renders breadcrumbs with Home first", () => {
    const nav = q1(parse(String(Layout({ ...chrome, children: "" }))), {
      tag: "nav",
      cls: "breadcrumbs",
    });
    expect(nav).not.toBeNull();
    if (!nav) return;
    const first = q1(nav, { tag: "a" });
    expect(first && text(first)).toBe(messages.home);
    expect(first && attr(first, "href")).toBe("/admin/");
    expect(text(nav)).toContain("Authors");
  });

  it("renders one li per flash message with the level as class", () => {
    const doc = render({
      flash: [
        { level: "success", text: "ok" },
        { level: "warning", text: "hmm" },
        { level: "error", text: "bad" },
      ],
    });
    const list = q1(doc, { tag: "ul", cls: "messagelist" });
    expect(list).not.toBeNull();
    if (!list) return;
    for (const [level, t] of [
      ["success", "ok"],
      ["warning", "hmm"],
      ["error", "bad"],
    ] as const) {
      const li = qsa(list, { tag: "li", cls: level });
      expect(li).toHaveLength(1);
      expect(li[0] && text(li[0])).toBe(t);
    }
  });

  it("renders the logout form with a CSRF input only when showLogout is true", () => {
    const withLogout = render();
    const form = q1(withLogout, { tag: "form", attrs: { action: "/admin/logout/" } });
    expect(form && attr(form, "method")).toBe("post");
    const csrf = form && q1(form, { tag: "input", attrs: { name: "_csrf" } });
    expect(csrf && attr(csrf, "value")).toBe("tok<en");

    expect(qsa(render({ showLogout: false }), { tag: "form" })).toHaveLength(0);
    expect(qsa(render({ user: null, showLogout: false }), { tag: "form" })).toHaveLength(0);
  });
});

describe("DashboardPage", () => {
  const models = [
    { slug: "authors", label: "Authors", canAdd: true },
    { slug: "kv", label: "KV", canAdd: false },
  ];
  const doc = parse(String(DashboardPage({ ...chrome, models })));

  it("renders one row per model with a change link", () => {
    const table = q1(doc, { tag: "table", id: "dashboard" });
    expect(table).not.toBeNull();
    if (!table) return;
    for (const m of models) {
      const rows = qsa(table, { tag: "tr", attrs: { "data-model": m.slug } });
      expect(rows).toHaveLength(1);
      const link = rows[0] && q1(rows[0], { tag: "a", cls: "changelink" });
      expect(link && attr(link, "href")).toBe(`/admin/${m.slug}/`);
    }
  });

  it("renders an add link only when canAdd", () => {
    const authors = qsa(doc, { tag: "tr", attrs: { "data-model": "authors" } })[0];
    const kv = qsa(doc, { tag: "tr", attrs: { "data-model": "kv" } })[0];
    const add = authors && q1(authors, { tag: "a", cls: "addlink" });
    expect(add && attr(add, "href")).toBe("/admin/authors/add/");
    expect(kv && q1(kv, { tag: "a", cls: "addlink" })).toBeNull();
  });
});

describe("ListPage", () => {
  const listProps: PageChrome & ListPageProps = {
    ...chrome,
    model: { slug: "authors", label: "Authors" },
    columns: [
      { key: "id", sort: "desc", sortHref: "/admin/authors/?o=id" },
      { key: "name", sort: "none", sortHref: "/admin/authors/?o=name" },
      { key: "email", sort: "asc", sortHref: "/admin/authors/?o=-email" },
    ],
    rows: [
      {
        pk: "1",
        cells: [{ text: "1" }, { text: "Ann", href: "/admin/authors/1/change/" }, { text: "-" }],
      },
      { pk: "a b", cells: [{ text: "2" }, { text: "<script>alert(1)</script>" }, { text: "x@y" }] },
    ],
    q: "ann",
    filters: [
      {
        key: "role",
        choices: [
          { label: messages.all, href: "/admin/authors/", selected: false },
          { label: "admin", href: "/admin/authors/?f_role=admin", selected: true },
        ],
      },
    ],
    actions: [{ name: "delete_selected", label: messages.deleteSelected }],
    canAdd: true,
    page: 3,
    pages: 9,
    total: 87,
    pageHref: (n) => `/admin/authors/?p=${n}`,
    backQuery: "?q=ann&p=3",
  };
  const render = (over: Partial<ListPageProps> = {}) =>
    parse(String(ListPage({ ...listProps, ...over })));
  const doc = render();

  it("renders the search form only when q is not null", () => {
    const form = q1(doc, { tag: "form", id: "changelist-search" });
    expect(form && attr(form, "method")).toBe("get");
    const input = form && q1(form, { tag: "input", attrs: { name: "q" } });
    expect(input && attr(input, "value")).toBe("ann");
    expect(q1(render({ q: null }), { tag: "form", id: "changelist-search" })).toBeNull();
    expect(q1(render({ q: undefined }), { tag: "form", id: "changelist-search" })).not.toBeNull();
  });

  it("renders filters with the selected choice marked", () => {
    const aside = q1(doc, { tag: "aside", id: "changelist-filter" });
    const filter = aside && q1(aside, { tag: "div", attrs: { "data-filter": "role" } });
    expect(filter && qsa(filter, { tag: "a" })).toHaveLength(2);
    const selected = filter ? qsa(filter, { cls: "selected" }) : [];
    expect(selected).toHaveLength(1);
    expect(selected[0] && text(selected[0])).toBe("admin");
    expect(q1(render({ filters: [] }), { tag: "aside" })).toBeNull();
  });

  it("renders sortable headers", () => {
    for (const c of listProps.columns) {
      const th = q1(doc, { tag: "th", attrs: { "data-key": c.key } });
      expect(th && attr(th, "data-sort")).toBe(c.sort);
      const a = th && q1(th, { tag: "a", cls: "sort" });
      expect(a && attr(a, "href")).toBe(c.sortHref);
    }
    expect(q1(doc, { tag: "table", id: "result_list" })).not.toBeNull();
    const results = q1(doc, { tag: "div", cls: "results" });
    expect(results && q1(results, { tag: "table", id: "result_list" })).not.toBeNull();
  });

  it("renders row checkboxes, cell links and the action form", () => {
    const boxes = qsa(doc, { tag: "input", attrs: { name: "_selected" } });
    expect(boxes.map((b) => attr(b, "value"))).toEqual(["1", "a b"]);
    const link = q1(doc, { tag: "a", attrs: { href: "/admin/authors/1/change/" } });
    expect(link && text(link)).toBe("Ann");

    const form = q1(doc, { tag: "form", id: "changelist-form" });
    expect(form && attr(form, "method")).toBe("post");
    expect(form && attr(form, "action")).toBe("/admin/authors/?q=ann&p=3");
    const csrf = form && q1(form, { tag: "input", attrs: { name: "_csrf" } });
    expect(csrf && attr(csrf, "value")).toBe("tok<en");
    const select = form && q1(form, { tag: "select", attrs: { name: "action" } });
    expect(
      select && qsa(select, { tag: "option", attrs: { value: "delete_selected" } }),
    ).toHaveLength(1);
    expect(form && q1(form, { tag: "button", attrs: { name: "index" } })).not.toBeNull();
  });

  it("omits the action select when there are no actions", () => {
    const none = render({ actions: [] });
    expect(q1(none, { tag: "select", attrs: { name: "action" } })).toBeNull();
    expect(q1(none, { tag: "button", attrs: { name: "index" } })).toBeNull();
  });

  it("renders the select-all toggle hidden plus the unescaped script", () => {
    const toggle = q1(doc, { tag: "input", id: "action-toggle" });
    expect(toggle && attr(toggle, "hidden")).not.toBeNull();
    const scripts = qsa(doc, { tag: "script" });
    expect(scripts).toHaveLength(1);
    expect(scripts[0] && text(scripts[0])).toBe(SELECT_ALL_SCRIPT);
  });

  it("renders the paginator with 5 numbers around the current page", () => {
    const p = q1(doc, { tag: "p", cls: "paginator" });
    expect(p).not.toBeNull();
    if (!p) return;
    const current = qsa(p, { tag: "span", cls: "this-page" });
    expect(current).toHaveLength(1);
    expect(current[0] && text(current[0])).toBe("3");
    const numbers = qsa(p, { tag: "a" })
      .map((a) => text(a))
      .filter((t) => /^\d+$/.test(t));
    expect(numbers).toEqual(["1", "2", "4", "5"]);
    const prev = q1(p, { tag: "a", cls: "prev" });
    expect(prev && attr(prev, "href")).toBe("/admin/authors/?p=2");
    const next = q1(p, { tag: "a", cls: "next" });
    expect(next && attr(next, "href")).toBe("/admin/authors/?p=4");
    const count = q1(p, { cls: "result-count" });
    expect(count && text(count)).toBe(messages.resultCount(87));
  });

  it("clamps the page window at both ends and hides prev/next at the edges", () => {
    const pageNumbers = (page: number, pages: number) => {
      const p = q1(render({ page, pages }), { tag: "p", cls: "paginator" });
      return p
        ? qsa(p, { tag: "a" })
            .map((a) => text(a))
            .filter((t) => /^\d+$/.test(t))
            .concat(qsa(p, { cls: "this-page" }).map((s) => `[${text(s)}]`))
        : [];
    };
    expect(pageNumbers(1, 9).sort()).toEqual(["2", "3", "4", "5", "[1]"]);
    expect(pageNumbers(9, 9).sort()).toEqual(["5", "6", "7", "8", "[9]"]);
    expect(pageNumbers(1, 2).sort()).toEqual(["2", "[1]"]);
    const first = q1(render({ page: 1, pages: 9 }), { tag: "p", cls: "paginator" });
    expect(first && q1(first, { cls: "prev" })).toBeNull();
    const last = q1(render({ page: 9, pages: 9 }), { tag: "p", cls: "paginator" });
    expect(last && q1(last, { cls: "next" })).toBeNull();
    const empty = q1(render({ rows: [], page: 1, pages: 0, total: 0 }), {
      tag: "p",
      cls: "paginator",
    });
    const count = empty && q1(empty, { cls: "result-count" });
    expect(count && text(count)).toBe(messages.resultCount(0));
  });

  it("renders the add link only when canAdd", () => {
    const add = q1(doc, { tag: "a", cls: "addlink" });
    expect(add && attr(add, "href")).toBe("/admin/authors/add/");
    expect(q1(render({ canAdd: false }), { tag: "a", cls: "addlink" })).toBeNull();
  });

  it("escapes cell text and renders no script besides the select-all script", () => {
    const cell = qsa(doc, { tag: "td" }).find((td) => text(td).includes("alert(1)"));
    expect(cell && text(cell)).toBe("<script>alert(1)</script>");
    expect(cell && qsa(cell, { tag: "script" })).toHaveLength(0);
    expect(qsa(doc, { tag: "script" })).toHaveLength(1);
  });
});

describe("ErrorPage", () => {
  it("renders the status heading and the message inside the layout", () => {
    const doc = parse(String(ErrorPage({ ...chrome, status: 404, message: messages.notFound })));
    const h1 = q1(doc, { tag: "h1" });
    expect(h1 && text(h1)).toBe("404");
    const msg = q1(doc, { tag: "p", cls: "error-message" });
    expect(msg && text(msg)).toBe(messages.notFound);
    expect(q1(doc, { tag: "header", id: "header" })).not.toBeNull();
  });

  it("escapes the message", () => {
    const doc = parse(String(ErrorPage({ ...chrome, status: 500, message: "<b>x</b>" })));
    expect(qsa(doc, { tag: "b" })).toHaveLength(0);
    const msg = q1(doc, { tag: "p", cls: "error-message" });
    expect(msg && text(msg)).toBe("<b>x</b>");
  });
});

describe("LoginPage", () => {
  const render = (over: { username?: string; error?: string; next?: string } = {}) =>
    parse(
      String(
        LoginPage({
          ...chrome,
          user: null,
          showLogout: false,
          title: messages.login,
          next: "/admin/authors/?q=a",
          username: "",
          ...over,
        }),
      ),
    );

  it("posts the login form to the login URL", () => {
    const form = q1(render(), { tag: "form", id: "login-form" });
    expect(form).not.toBeNull();
    expect(form && attr(form, "method")).toBe("post");
    expect(form && attr(form, "action")).toBe("/admin/login/");
  });

  it("keeps the username and never renders a password value", () => {
    const doc = render({ username: 'al"<ice' });
    const user = q1(doc, { tag: "input", attrs: { name: "username" } });
    expect(user && attr(user, "value")).toBe('al"<ice');
    const pass = q1(doc, { tag: "input", attrs: { name: "password" } });
    expect(pass && attr(pass, "type")).toBe("password");
    expect(pass && (attr(pass, "value") ?? "")).toBe("");
  });

  it("renders the hidden next and _csrf inputs", () => {
    const doc = render();
    const next = q1(doc, { tag: "input", attrs: { type: "hidden", name: "next" } });
    expect(next && attr(next, "value")).toBe("/admin/authors/?q=a");
    const csrf = q1(doc, { tag: "input", attrs: { type: "hidden", name: "_csrf" } });
    expect(csrf && attr(csrf, "value")).toBe("tok<en");
  });

  it("renders the labels and submit button from messages", () => {
    const doc = render();
    const form = q1(doc, { tag: "form", id: "login-form" });
    expect(form && text(form)).toContain(messages.username);
    expect(form && text(form)).toContain(messages.password);
    const button = form && q1(form, { tag: "button" });
    expect(button && text(button)).toBe(messages.login);
  });

  it("renders p.errornote only when an error is given", () => {
    expect(qsa(render(), { tag: "p", cls: "errornote" })).toHaveLength(0);
    const note = q1(render({ error: messages.loginFailed }), { tag: "p", cls: "errornote" });
    expect(note && text(note)).toBe(messages.loginFailed);
  });
});
