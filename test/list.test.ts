import { sql, type Table } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { messages } from "../src/messages.js";
import { calendarPresetRange, toDateOnly } from "../src/time.js";
import { makeAdmin, type TestAdmin } from "./helpers/app.js";
import { type DialectFixture, dialects } from "./helpers/db.js";
import { attr, type Node, parse, qs, qsa, text } from "./helpers/html.js";

afterEach(() => {
  vi.restoreAllMocks();
});

// Fixture inserts and DDL go through the untyped `db` handed out by the fixture.
type RawDb = {
  insert(table: Table): { values(rows: unknown): PromiseLike<unknown> };
  delete(table: Table): PromiseLike<unknown>;
  run?(query: unknown): unknown;
  execute?(query: unknown): PromiseLike<unknown>;
};
const raw = (t: TestAdmin) => t.db as RawDb;

interface Row {
  cells: Record<string, string>;
  hrefs: Record<string, string | null>;
  pk: string | null;
}

async function page(t: TestAdmin, path: string): Promise<{ status: number; doc: Node }> {
  const res = await t.client.get(path);
  return { status: res.status, doc: parse(await res.text()) };
}

/** Body rows of `table#result_list`, keyed by the `data-key` of each header. */
function rowsOf(doc: Node): Row[] {
  const table = qs(doc, { tag: "table", id: "result_list" });
  if (table === null) throw new Error("no table#result_list");
  const keys = qsa(table, { tag: "th" }).flatMap((th) => attr(th, "data-key") ?? []);
  const body = qs(table, { tag: "tbody" });
  if (body === null) throw new Error("no tbody");
  return qsa(body, { tag: "tr" }).map((tr) => {
    const [checkbox, ...tds] = qsa(tr, { tag: "td" });
    const cells: Row["cells"] = {};
    const hrefs: Row["hrefs"] = {};
    keys.forEach((key, i) => {
      const td = tds[i];
      if (td === undefined) throw new Error(`missing cell ${key}`);
      cells[key] = text(td).trim();
      const a = qs(td, { tag: "a" });
      hrefs[key] = a === null ? null : attr(a, "href");
    });
    const input = checkbox === undefined ? null : qs(checkbox, { tag: "input" });
    return { cells, hrefs, pk: input === null ? null : attr(input, "value") };
  });
}

const column = (doc: Node, key: string): string[] => rowsOf(doc).map((r) => r.cells[key] ?? "");

function filterBox(doc: Node, key: string): Node {
  const box = qs(doc, { tag: "div", attrs: { "data-filter": key } });
  if (box === null) throw new Error(`no filter ${key}`);
  return box;
}

const filterLinks = (doc: Node, key: string) =>
  qsa(filterBox(doc, key), { tag: "a" }).map((a) => ({
    label: text(a).trim(),
    params: new URL(attr(a, "href") ?? "", "http://x").searchParams,
  }));

function selectedLabel(doc: Node, key: string): string[] {
  return qsa(filterBox(doc, key), { tag: "li", cls: "selected" }).map((li) => text(li).trim());
}

function header(doc: Node, key: string): { sort: string | null; params: URLSearchParams } {
  const th = qs(doc, { tag: "th", attrs: { "data-key": key } });
  const a = th === null ? null : qs(th, { tag: "a", cls: "sort" });
  if (th === null || a === null) throw new Error(`no header ${key}`);
  return {
    sort: attr(th, "data-sort"),
    params: new URL(attr(a, "href") ?? "", "http://x").searchParams,
  };
}

const AUTHOR_DISPLAY = ["id", "name", "email", "active", "role"];

describe.each(dialects)("list page ($name)", (fixture) => {
  let t: TestAdmin;
  beforeAll(async () => {
    t = await makeAdmin(fixture, {
      models: {
        authors: {
          listDisplay: AUTHOR_DISPLAY,
          listDisplayLinks: ["name"],
          searchFields: ["name", "email"],
          listFilter: ["active", "role"],
          ordering: ["-name"],
          toString: (row) => String(row.name),
          actions: [{ name: "promote", label: "Promote", run: async () => {} }],
        },
        articles: {
          listDisplay: ["id", "title", "authorId", "views"],
          searchFields: ["title"],
          listFilter: ["authorId"],
          listPerPage: 3,
        },
        // PG only; ignored where the fixture has no events table.
        events: {
          listDisplay: ["id", "day", "due", "note"],
          searchFields: ["code", "amount", "mood"],
          listFilter: ["due"],
        },
      },
    });
  });
  afterAll(async () => {
    await t.close();
  });

  it("renders the list with table#result_list", async () => {
    const { status, doc } = await page(t, "/admin/authors/");
    expect(status).toBe(200);
    expect(qs(doc, { tag: "table", id: "result_list" })).not.toBeNull();
    expect(qs(doc, { tag: "form", id: "changelist-search" })).not.toBeNull();
    // Default order is the configured `-name`.
    expect(column(doc, "name")).toEqual(["dave", "carol", "bob", "alice"]);
  });

  it("answers an unknown model with 404", async () => {
    const res = await t.client.get("/admin/nope/");
    expect(res.status).toBe(404);
    expect(text(parse(await res.text()))).toContain(messages.notFound);
  });

  it("matches a wildcard in the search text literally", async () => {
    const percent = await page(t, "/admin/articles/?q=%25");
    expect(column(percent.doc, "title")).toEqual(["Rate 100% done"]);
    const underscore = await page(t, "/admin/articles/?q=_");
    expect(column(underscore.doc, "title")).toEqual(["snake_case"]);
  });

  it("ignores q when searchFields is empty and hides the search form", async () => {
    const { status, doc } = await page(t, "/admin/kv/?q=zzz");
    expect(status).toBe(200);
    expect(qs(doc, { tag: "form", id: "changelist-search" })).toBeNull();
    expect(column(doc, "key").sort()).toEqual(["a", "b", "c"]);
  });

  it("filters by a boolean and keeps q and o in every link", async () => {
    const { doc } = await page(t, "/admin/authors/?q=a&o=name&f_active=1");
    expect(column(doc, "name")).toEqual(["alice", "bob", "dave"]);
    expect(selectedLabel(doc, "active")).toEqual([messages.yes]);
    const links = filterLinks(doc, "active");
    expect(links.map((l) => l.label)).toEqual([messages.all, messages.yes, messages.no]);
    for (const link of links) {
      expect(link.params.get("q")).toBe("a");
      expect(link.params.get("o")).toBe("name");
    }
    expect(links[0]?.params.has("f_active")).toBe(false);
    expect(links[2]?.params.get("f_active")).toBe("0");
  });

  it("marks all as selected without a filter value", async () => {
    const { doc } = await page(t, "/admin/authors/");
    expect(selectedLabel(doc, "active")).toEqual([messages.all]);
    const bogus = await page(t, "/admin/authors/?f_role=nobody");
    expect(selectedLabel(bogus.doc, "role")).toEqual([messages.all]);
    expect(column(bogus.doc, "name")).toHaveLength(4);
  });

  it("filters by an enum", async () => {
    const { doc } = await page(t, "/admin/authors/?q=a&o=-name&f_role=viewer");
    expect(column(doc, "name")).toEqual(["dave", "carol"]);
    expect(selectedLabel(doc, "role")).toEqual(["viewer"]);
    const links = filterLinks(doc, "role");
    expect(links.map((l) => l.label)).toEqual([messages.all, "admin", "editor", "viewer"]);
    for (const link of links) {
      expect(link.params.get("q")).toBe("a");
      expect(link.params.get("o")).toBe("-name");
    }
  });

  it("filters by a foreign key with the referenced model's labels", async () => {
    const { doc } = await page(t, "/admin/articles/?q=a&o=title&f_authorId=2");
    expect(column(doc, "title")).toEqual(["Gamma", "Rate 100% done"]);
    expect(selectedLabel(doc, "authorId")).toEqual(["bob"]);
    const links = filterLinks(doc, "authorId");
    expect(links.map((l) => l.label)).toEqual([messages.all, "dave", "carol", "bob", "alice"]);
    for (const link of links) {
      expect(link.params.get("q")).toBe("a");
      expect(link.params.get("o")).toBe("title");
    }
  });

  it("cycles the header link asc -> desc -> off and tracks data-sort", async () => {
    const none = header((await page(t, "/admin/authors/?q=a")).doc, "name");
    expect(none.sort).toBe("none");
    expect(none.params.get("o")).toBe("name");
    expect(none.params.get("q")).toBe("a");

    const asc = header((await page(t, "/admin/authors/?q=a&o=name")).doc, "name");
    expect(asc.sort).toBe("asc");
    expect(asc.params.get("o")).toBe("-name");

    const desc = header((await page(t, "/admin/authors/?q=a&o=-name")).doc, "name");
    expect(desc.sort).toBe("desc");
    expect(desc.params.has("o")).toBe(false);
    expect(desc.params.get("q")).toBe("a");
  });

  it("orders by the requested key", async () => {
    const asc = await page(t, "/admin/authors/?o=name");
    expect(column(asc.doc, "name")).toEqual(["alice", "bob", "carol", "dave"]);
    const desc = await page(t, "/admin/authors/?o=-id");
    expect(column(desc.doc, "id")).toEqual(["4", "3", "2", "1"]);
  });

  it("ignores o on a key outside listDisplay", async () => {
    // createdAt exists on the table but is not displayed.
    const { doc } = await page(t, "/admin/authors/?o=createdAt,-bogus");
    expect(column(doc, "name")).toEqual(["dave", "carol", "bob", "alice"]);
    for (const key of AUTHOR_DISPLAY) expect(header(doc, key).sort).toBe("none");
  });

  it("paginates with p, this-page and the total", async () => {
    const first = await page(t, "/admin/articles/");
    expect(column(first.doc, "id")).toEqual(["7", "6", "5"]);
    expect(text(qs(first.doc, { tag: "span", cls: "this-page" }) as Node)).toBe("1");
    expect(text(qs(first.doc, { tag: "span", cls: "result-count" }) as Node)).toBe(
      messages.resultCount(7),
    );

    const second = await page(t, "/admin/articles/?p=2");
    expect(column(second.doc, "id")).toEqual(["4", "3", "2"]);
    expect(text(qs(second.doc, { tag: "span", cls: "this-page" }) as Node)).toBe("2");

    const third = await page(t, "/admin/articles/?p=3");
    expect(column(third.doc, "id")).toEqual(["1"]);

    const beyond = await page(t, "/admin/articles/?p=99");
    expect(beyond.status).toBe(200);
    expect(rowsOf(beyond.doc)).toHaveLength(0);
    expect(qs(beyond.doc, { tag: "span", cls: "result-count" })).not.toBeNull();
  });

  it("treats a bad p as page 1", async () => {
    for (const p of ["0", "-2", "abc", "1.5", ""]) {
      const { doc } = await page(t, `/admin/articles/?p=${encodeURIComponent(p)}`);
      expect(column(doc, "id")).toEqual(["7", "6", "5"]);
    }
  });

  it("drops p from search, filter and sort links", async () => {
    const { doc } = await page(t, "/admin/articles/?p=2&q=a");
    for (const link of filterLinks(doc, "authorId")) expect(link.params.has("p")).toBe(false);
    expect(header(doc, "title").params.has("p")).toBe(false);
  });

  it("shows booleans as check marks and null as a dash", async () => {
    const { doc } = await page(t, "/admin/authors/?o=name");
    const rows = rowsOf(doc);
    expect(rows[0]?.cells.active).toBe("✓");
    expect(rows[2]?.cells.active).toBe("✗");
    expect(rows[2]?.cells.email).toBe("-");
    expect(rows[0]?.cells.email).toBe("alice@example.com");
  });

  it("links an FK cell to the referenced change page with its toString", async () => {
    const { doc } = await page(t, "/admin/articles/?q=Gamma");
    const [row] = rowsOf(doc);
    expect(row?.cells.authorId).toBe("bob");
    expect(row?.hrefs.authorId).toBe("/admin/authors/2/change/");
  });

  it("links listDisplayLinks cells to the row's change page", async () => {
    const { doc } = await page(t, "/admin/authors/?o=name");
    const [row] = rowsOf(doc);
    expect(row?.hrefs.name).toBe("/admin/authors/1/change/");
    expect(row?.hrefs.email).toBeNull();
    expect(row?.pk).toBe("1");
  });

  it("offers delete_selected and custom actions, posting back to the same state", async () => {
    const { doc } = await page(t, "/admin/authors/?q=a&o=name");
    const options = qsa(qs(doc, { tag: "select", attrs: { name: "action" } }) as Node, {
      tag: "option",
    }).map((o) => attr(o, "value"));
    expect(options).toEqual(["", "delete_selected", "promote"]);
    const form = qs(doc, { tag: "form", id: "changelist-form" });
    expect(attr(form as Node, "action")).toBe("/admin/authors/?q=a&o=name");
  });

  it.skipIf(fixture.dialect !== "postgres")("searches uuid, numeric and enum columns", async () => {
    const byMood = await page(t, "/admin/events/?q=busy");
    expect(byMood.status).toBe(200);
    expect(column(byMood.doc, "note")).toEqual(["today"]);

    const byAmount = await page(t, "/admin/events/?q=12.5");
    expect(byAmount.status).toBe(200);
    expect(column(byAmount.doc, "note")).toEqual(["previous day"]);

    const byCode = await page(t, "/admin/events/?q=a1b2c3d4-0000-4000-8000-000000000003");
    expect(byCode.status).toBe(200);
    expect(column(byCode.doc, "note")).toEqual(["next day"]);
  });

  it.skipIf(fixture.dialect !== "postgres")(
    "shows a date-only Date as YYYY/MM/DD and a date string as stored",
    async () => {
      const { doc } = await page(t, "/admin/events/?q=busy");
      const [row] = rowsOf(doc);
      expect(row?.cells.day).toBe("2026/10/07");
      expect(row?.cells.due).toBe("2026-10-07");
    },
  );

  it.skipIf(fixture.dialect !== "postgres")(
    "offers the date presets for a date-only string column",
    async () => {
      const { doc } = await page(t, "/admin/events/");
      expect(filterLinks(doc, "due").map((l) => l.label)).toEqual([
        messages.all,
        messages.today,
        messages.past7,
        messages.thisMonth,
        messages.thisYear,
      ]);
    },
  );
});

describe.each(dialects)("list page with extra rows ($name)", (fixture) => {
  let t: TestAdmin;
  const LONG_TITLE = "x".repeat(150);

  beforeAll(async () => {
    t = await makeAdmin(fixture, {
      models: {
        authors: { toString: (row) => String(row.name) },
        articles: {
          listDisplay: ["id", "title", "authorId", "publishedAt"],
          searchFields: ["title"],
          listFilter: ["authorId", "publishedAt"],
          listPerPage: 50,
        },
      },
    });
    const { articles } = t.schema;
    // 7 seeded + 23 = 30 articles; author 1 ends up with exactly 3 of them.
    const extra = Array.from({ length: 23 }, (_, i) => ({
      title: i === 0 ? "Fresh" : i === 1 ? LONG_TITLE : `bulk ${i}`,
      authorId: i === 0 ? 1 : 2 + (i % 3),
      publishedAt: i === 0 ? new Date() : null,
    }));
    await raw(t).insert(articles).values(extra);
  });
  afterAll(async () => {
    await t.close();
  });

  const queriesFor = async (path: string) => {
    const before = t.queryCount();
    const { status, doc } = await page(t, path);
    expect(status).toBe(200);
    return { queries: t.queryCount() - before, rows: rowsOf(doc) };
  };

  it("issues the same number of queries for 30 rows as for 3 (no N+1)", async () => {
    const full = await queriesFor("/admin/articles/");
    const small = await queriesFor("/admin/articles/?f_authorId=1");
    expect(full.rows).toHaveLength(30);
    expect(small.rows).toHaveLength(3);
    expect(full.queries).toBe(small.queries);
  });

  it("truncates long text with an ellipsis", async () => {
    const { doc } = await page(t, "/admin/articles/?q=xxxxx");
    expect(column(doc, "title")).toEqual([`${"x".repeat(100)}…`]);
  });

  it("filters by a date preset and keeps the other params", async () => {
    const { doc } = await page(t, "/admin/articles/?q=e&o=title&f_publishedAt=today");
    const titles = column(doc, "title");
    expect(titles).toContain("Fresh");
    expect(titles).not.toContain("Gamma");
    expect(titles.some((title) => title.startsWith("bulk"))).toBe(false);
    expect(selectedLabel(doc, "publishedAt")).toEqual([messages.today]);
    const links = filterLinks(doc, "publishedAt");
    expect(links.map((l) => l.label)).toEqual([
      messages.all,
      messages.today,
      messages.past7,
      messages.thisMonth,
      messages.thisYear,
    ]);
    for (const link of links) {
      expect(link.params.get("q")).toBe("e");
      expect(link.params.get("o")).toBe("title");
    }
    expect(links[2]?.params.get("f_publishedAt")).toBe("past7");
  });
});

describe.each(dialects)("list page permissions and failures ($name)", (fixture) => {
  let t: TestAdmin;
  beforeAll(async () => {
    t = await makeAdmin(fixture, {
      models: {
        authors: {
          permissions: { add: false, change: false, delete: false },
          actions: [{ name: "promote", label: "Promote", run: async () => {} }],
        },
        articles: { permissions: { view: false } },
        kv: {
          searchFields: ["value"],
          formatters: {
            value: () => {
              throw new Error("formatter-exploded");
            },
          },
        },
      },
    });
  });
  afterAll(async () => {
    await t.close();
  });

  it("answers 403 without the view permission", async () => {
    const res = await t.client.get("/admin/articles/");
    expect(res.status).toBe(403);
    expect(text(parse(await res.text()))).toContain(messages.forbidden);
  });

  it("offers no actions and no add link without the permissions", async () => {
    const { status, doc } = await page(t, "/admin/authors/");
    expect(status).toBe(200);
    expect(qs(doc, { tag: "select", attrs: { name: "action" } })).toBeNull();
    expect(qs(doc, { tag: "a", cls: "addlink" })).toBeNull();
  });

  const logged = (spy: { mock: { calls: unknown[][] } }): string =>
    spy.mock.calls
      .flat()
      .map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack}` : String(arg)))
      .join("\n");

  it("renders 500 and logs the message of a throwing formatter", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await t.client.get("/admin/kv/");
    expect(res.status).toBe(500);
    expect(text(parse(await res.text()))).toContain(messages.serverError);
    expect(logged(spy)).toContain("formatter-exploded");
  });

  it("renders 500 for a database error without logging the search text", async () => {
    // The kv table disappears under a registered model, as with a failed migration.
    const db = raw(t);
    if (fixture.dialect === "sqlite") db.run?.(sql`drop table kv`);
    else await db.execute?.(sql`drop table kv`);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await t.client.get("/admin/kv/?q=secretvalue");
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
    for (const arg of spy.mock.calls.flat()) {
      const shown = arg instanceof Error ? `${arg.message}\n${arg.stack}` : String(arg);
      expect(shown).not.toContain("secretvalue");
      expect(JSON.stringify(arg) ?? "").not.toContain("secretvalue");
    }
    expect(await res.text()).not.toContain("secretvalue");
  });
});

// Dialect-specific pieces of the fixture only exist on PG (events).
const pg = dialects.find((d): d is DialectFixture => d.name === "pglite") as DialectFixture;

describe.each(["Asia/Tokyo", "America/New_York"])("f_due=today in %s (pglite)", (timeZone) => {
  let t: TestAdmin;
  beforeAll(async () => {
    t = await makeAdmin(pg, {
      config: { timeZone },
      models: { events: { listDisplay: ["id", "due", "note"], listFilter: ["due"] } },
    });
    const events = t.schema.events as Table;
    const today = calendarPresetRange("today", new Date(), timeZone).start;
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const event = (note: string, due: Date) => ({ day: due, due: toDateOnly(due), note });
    // Only these two rows exist, so the filter result is exact whatever day the test runs on.
    await raw(t).delete(events);
    await raw(t)
      .insert(events)
      .values([event("is-today", today), event("is-yesterday", yesterday)]);
  });
  afterAll(async () => {
    await t.close();
  });

  it("lists only the row due on the calendar date in the configured time zone", async () => {
    const all = await page(t, "/admin/events/");
    expect(column(all.doc, "note").sort()).toEqual(["is-today", "is-yesterday"]);

    const { status, doc } = await page(t, "/admin/events/?f_due=today");
    expect(status).toBe(200);
    expect(column(doc, "note")).toEqual(["is-today"]);
    expect(selectedLabel(doc, "due")).toEqual([messages.today]);
  });
});
