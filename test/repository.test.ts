import { afterEach, describe, expect, it } from "vitest";
import { createRepository, type DbRow, type ListParams } from "../src/data/repository.js";
import { introspectTable } from "../src/introspect/index.js";
import { type DialectFixture, dialects, type SetupResult } from "./helpers/db.js";

const TOKYO = "Asia/Tokyo";
// 2026-10-07 01:00 in Tokyo, but still 2026-10-06 in UTC.
const NOW = new Date("2026-10-06T16:00:00Z");

const params = (over: Partial<ListParams> = {}): ListParams => ({
  searchFields: [],
  filters: {},
  ordering: [],
  page: 1,
  perPage: 50,
  ...over,
});

const col = (rows: DbRow[], key: string) => rows.map((r) => r[key]);

describe.each(dialects)("repository ($name)", (fx: DialectFixture) => {
  const open: SetupResult[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
  });

  async function make() {
    const s = await fx.setup();
    open.push(s);
    const repo = createRepository({
      db: s.db,
      dialect: fx.dialect,
      timeZone: TOKYO,
      now: () => NOW,
    });
    const meta = (key: "authors" | "articles" | "kv") => introspectTable(s.schema[key], fx.dialect);
    return { s, repo, authors: meta("authors"), articles: meta("articles"), kv: meta("kv") };
  }

  describe("list", () => {
    it("returns the total and rows", async () => {
      const { repo, authors } = await make();
      const { rows, total } = await repo.list(authors, params());
      expect(total).toBe(4);
      expect(rows).toHaveLength(4);
      expect(typeof total).toBe("number");
    });

    it("pages with page and perPage, keeping the total", async () => {
      const { repo, articles } = await make();
      const ordering = [{ key: "views", desc: false }];
      const p1 = await repo.list(articles, params({ ordering, page: 1, perPage: 3 }));
      const p3 = await repo.list(articles, params({ ordering, page: 3, perPage: 3 }));
      const p4 = await repo.list(articles, params({ ordering, page: 4, perPage: 3 }));
      expect(p1.total).toBe(7);
      expect(col(p1.rows, "views")).toEqual([10, 20, 30]);
      expect(col(p3.rows, "views")).toEqual([70]);
      expect(p4.rows).toEqual([]);
      expect(p4.total).toBe(7);
    });

    it("orders ascending and descending, then by pk", async () => {
      const { repo, articles, authors } = await make();
      const asc = await repo.list(articles, params({ ordering: [{ key: "views", desc: false }] }));
      expect(col(asc.rows, "views")).toEqual([10, 20, 30, 40, 50, 60, 70]);
      const desc = await repo.list(articles, params({ ordering: [{ key: "views", desc: true }] }));
      expect(col(desc.rows, "views")).toEqual([70, 60, 50, 40, 30, 20, 10]);
      // Ties on the first key fall back to ascending pk.
      const tie = await repo.list(authors, params({ ordering: [{ key: "active", desc: true }] }));
      expect(col(tie.rows, "id")).toEqual([1, 2, 4, 3]);
    });

    it("issues exactly 2 queries per call", async () => {
      const { s, repo, articles } = await make();
      expect(s.queryCount()).toBe(0);
      await repo.list(articles, params());
      expect(s.queryCount()).toBe(2);
      await repo.list(articles, params({ q: "alpha", searchFields: ["title"], page: 2 }));
      expect(s.queryCount()).toBe(4);
    });

    it("total reflects search and filters", async () => {
      const { repo, articles } = await make();
      const r = await repo.list(
        articles,
        params({ q: "Rate", searchFields: ["title"], perPage: 1 }),
      );
      expect(r.total).toBe(2);
      expect(r.rows).toHaveLength(1);
    });

    describe("search", () => {
      it("matches case-insensitively as a substring", async () => {
        const { repo, articles } = await make();
        const r = await repo.list(articles, params({ q: "  ALPH ", searchFields: ["title"] }));
        // SQLite LIKE is case-insensitive for ASCII; PG uses ilike.
        expect(col(r.rows, "title")).toEqual(["Alpha"]);
      });

      it("treats % literally", async () => {
        const { repo, articles } = await make();
        const r = await repo.list(articles, params({ q: "100%", searchFields: ["title"] }));
        expect(col(r.rows, "title")).toEqual(["Rate 100% done"]);
        expect(r.total).toBe(1);
      });

      it("treats _ literally", async () => {
        const { repo, articles } = await make();
        const r = await repo.list(articles, params({ q: "snake_case", searchFields: ["title"] }));
        expect(col(r.rows, "title")).toEqual(["snake_case"]);
      });

      it("treats backslash literally", async () => {
        const { repo, articles } = await make();
        await repo.create(articles, { title: "back\\slash", authorId: 1 });
        const r = await repo.list(articles, params({ q: "\\", searchFields: ["title"] }));
        expect(col(r.rows, "title")).toEqual(["back\\slash"]);
        expect(r.total).toBe(1);
      });

      it("searches several fields with OR", async () => {
        const { repo, authors } = await make();
        const r = await repo.list(
          authors,
          params({
            q: "bob@",
            searchFields: ["name", "email"],
            ordering: [{ key: "id", desc: false }],
          }),
        );
        expect(col(r.rows, "name")).toEqual(["bob"]);
      });

      it("ignores an empty q", async () => {
        const { repo, authors } = await make();
        const r = await repo.list(authors, params({ q: "   ", searchFields: ["name"] }));
        expect(r.total).toBe(4);
      });
    });

    describe("filters", () => {
      it("boolean", async () => {
        const { repo, authors } = await make();
        const on = await repo.list(authors, params({ filters: { active: "1" } }));
        const off = await repo.list(authors, params({ filters: { active: "0" } }));
        expect(on.total).toBe(3);
        expect(col(off.rows, "name")).toEqual(["carol"]);
      });

      it("enum", async () => {
        const { repo, authors } = await make();
        const r = await repo.list(authors, params({ filters: { role: "viewer" } }));
        expect(r.total).toBe(2);
        expect(col(r.rows, "role")).toEqual(["viewer", "viewer"]);
      });

      it("foreign key", async () => {
        const { repo, articles } = await make();
        const r = await repo.list(
          articles,
          params({ filters: { authorId: "2" }, ordering: [{ key: "id", desc: false }] }),
        );
        expect(col(r.rows, "title")).toEqual(["Gamma", "Rate 100% done"]);
      });

      it("date preset on a timestamp, in the injected timeZone and now", async () => {
        const { repo, articles } = await make();
        const order = [{ key: "id", desc: false }];
        // Tokyo "today" is [2026-10-06T15:00Z, 2026-10-07T15:00Z): only Alpha (2026-10-07T00:00Z).
        const today = await repo.list(
          articles,
          params({ filters: { publishedAt: "today" }, ordering: order }),
        );
        expect(col(today.rows, "title")).toEqual(["Alpha"]);
        const past7 = await repo.list(
          articles,
          params({ filters: { publishedAt: "past7" }, ordering: order }),
        );
        expect(col(past7.rows, "title")).toEqual(["Alpha", "Beta"]);
        const month = await repo.list(
          articles,
          params({ filters: { publishedAt: "month" }, ordering: order }),
        );
        expect(col(month.rows, "title")).toEqual(["Alpha", "Beta"]);
        const year = await repo.list(
          articles,
          params({ filters: { publishedAt: "year" }, ordering: order }),
        );
        expect(col(year.rows, "title")).toEqual(["Alpha", "Beta", "Gamma"]);
      });

      it("ignores invalid filter values", async () => {
        const { repo, authors, articles } = await make();
        expect(
          (await repo.list(authors, params({ filters: { active: "x", role: "nope" } }))).total,
        ).toBe(4);
        expect(
          (await repo.list(articles, params({ filters: { authorId: "abc", publishedAt: "bad" } })))
            .total,
        ).toBe(7);
      });
    });
  });

  describe("get", () => {
    it("returns the row, or null when absent", async () => {
      const { repo, authors } = await make();
      expect((await repo.get(authors, "2"))?.name).toBe("bob");
      expect(await repo.get(authors, "99")).toBeNull();
    });

    it("returns null for an invalid pk without querying", async () => {
      const { s, repo, authors } = await make();
      expect(await repo.get(authors, "abc")).toBeNull();
      expect(await repo.get(authors, "1.5")).toBeNull();
      expect(await repo.get(authors, "")).toBeNull();
      expect(s.queryCount()).toBe(0);
    });

    it("works with a text pk", async () => {
      const { repo, kv } = await make();
      expect(await repo.get(kv, "b")).toEqual({ key: "b", value: "two" });
    });

    it("round-trips a bigint column by equality", async () => {
      const { repo, articles } = await make();
      expect((await repo.get(articles, "1"))?.big).toBe(10n);
      expect((await repo.get(articles, "3"))?.big).toBeNull();
    });
  });

  describe("getMany", () => {
    it("returns the matching rows", async () => {
      const { repo, authors } = await make();
      const rows = await repo.getMany(authors, ["1", "3", "99"]);
      expect(col(rows, "name").sort()).toEqual(["alice", "carol"]);
    });

    it("drops invalid pks and dedupes", async () => {
      const { s, repo, authors } = await make();
      const rows = await repo.getMany(authors, ["2", "2", "x", "2.5"]);
      expect(col(rows, "name")).toEqual(["bob"]);
      expect(s.queryCount()).toBe(1);
    });

    it("issues no query when nothing valid remains", async () => {
      const { s, repo, authors } = await make();
      expect(await repo.getMany(authors, [])).toEqual([]);
      expect(await repo.getMany(authors, ["x"])).toEqual([]);
      expect(s.queryCount()).toBe(0);
    });
  });

  describe("create", () => {
    it("inserts and returns the row with defaults applied", async () => {
      const { repo, authors } = await make();
      const row = await repo.create(authors, { name: "erin" });
      expect(row).toMatchObject({ id: 5, name: "erin", email: null, active: true, role: "viewer" });
      expect(row.createdAt).toBeInstanceOf(Date);
      expect((await repo.list(authors, params())).total).toBe(5);
    });

    it("propagates the driver's unique violation unchanged", async () => {
      const { repo, authors } = await make();
      const error = (await repo.create(authors, { name: "alice" }).catch((e: unknown) => e)) as {
        message: string;
        code?: string;
        cause?: { message: string; code?: string };
      };
      // Drizzle may wrap the driver error, so look at the error and its cause alike.
      if (fx.name === "pglite") expect(error.code ?? error.cause?.code).toBe("23505");
      else expect(error.cause?.message ?? error.message).toMatch(/UNIQUE constraint failed/);
    });
  });

  describe("update", () => {
    it("updates and returns the row", async () => {
      const { repo, authors } = await make();
      const row = await repo.update(authors, "2", { email: "new@example.com", active: false });
      expect(row).toMatchObject({ id: 2, name: "bob", email: "new@example.com", active: false });
      expect((await repo.get(authors, "2"))?.email).toBe("new@example.com");
    });

    it("returns null for a missing row", async () => {
      const { repo, authors } = await make();
      expect(await repo.update(authors, "99", { email: "x" })).toBeNull();
    });

    it("returns null for an invalid pk without querying", async () => {
      const { s, repo, authors } = await make();
      expect(await repo.update(authors, "abc", { email: "x" })).toBeNull();
      expect(s.queryCount()).toBe(0);
    });

    it("returns get() for empty data", async () => {
      const { repo, authors } = await make();
      expect((await repo.update(authors, "1", {}))?.name).toBe("alice");
      expect(await repo.update(authors, "99", {})).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes rows and returns the count", async () => {
      const { repo, kv } = await make();
      expect(await repo.delete(kv, ["a", "c"])).toBe(2);
      expect(col(await repo.getMany(kv, ["a", "b", "c"]), "key")).toEqual(["b"]);
    });

    it("skips invalid pks and dedupes", async () => {
      const { s, repo, articles } = await make();
      expect(await repo.delete(articles, ["1", "1", "x"])).toBe(1);
      expect(s.queryCount()).toBe(1);
      expect(await repo.delete(articles, ["1"])).toBe(0);
    });

    it("issues no query for an empty or fully invalid list", async () => {
      const { s, repo, articles } = await make();
      expect(await repo.delete(articles, [])).toBe(0);
      expect(await repo.delete(articles, ["x", "y"])).toBe(0);
      expect(s.queryCount()).toBe(0);
    });
  });

  describe("options", () => {
    it("returns value and label in the given ordering, limited", async () => {
      const { repo, authors } = await make();
      const opts = await repo.options(authors, {
        limit: 3,
        ordering: [{ key: "name", desc: true }],
        toLabel: (row) => `Author ${String(row.name)}`,
      });
      expect(opts).toEqual([
        { value: "4", label: "Author dave" },
        { value: "3", label: "Author carol" },
        { value: "2", label: "Author bob" },
      ]);
    });

    it("stringifies a text pk", async () => {
      const { repo, kv } = await make();
      const opts = await repo.options(kv, {
        limit: 10,
        ordering: [],
        toLabel: (r) => String(r.value),
      });
      expect(opts).toEqual([
        { value: "a", label: "one" },
        { value: "b", label: "two" },
        { value: "c", label: "three" },
      ]);
    });
  });
});

// PG-only: non-text search and date-only columns (decisions 018, 019, 023).
describe("repository (pglite events)", () => {
  const fx = dialects.find((d) => d.name === "pglite") as DialectFixture;
  const open: SetupResult[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
  });

  async function make() {
    const s = await fx.setup();
    open.push(s);
    if (!s.schema.events) throw new Error("pglite fixture has no events table");
    const repo = createRepository({
      db: s.db,
      dialect: "postgres",
      timeZone: TOKYO,
      now: () => NOW,
    });
    return { repo, events: introspectTable(s.schema.events, "postgres") };
  }

  const order = [{ key: "id", desc: false }];

  it("searches a uuid column", async () => {
    const { repo, events } = await make();
    const r = await repo.list(
      events,
      params({
        q: "a1b2c3d4-0000-4000-8000-000000000002",
        searchFields: ["code"],
        ordering: order,
      }),
    );
    expect(col(r.rows, "note")).toEqual(["today"]);
  });

  it("searches a numeric column", async () => {
    const { repo, events } = await make();
    const r = await repo.list(
      events,
      params({ q: "99.95", searchFields: ["amount"], ordering: order }),
    );
    expect(col(r.rows, "note")).toEqual(["today"]);
  });

  it("searches a pgEnum column", async () => {
    const { repo, events } = await make();
    const r = await repo.list(
      events,
      params({ q: "calm", searchFields: ["mood"], ordering: order }),
    );
    expect(col(r.rows, "note")).toEqual(["previous day"]);
  });

  it("searches code, amount and mood together", async () => {
    const { repo, events } = await make();
    const r = await repo.list(
      events,
      params({ q: "busy", searchFields: ["code", "amount", "mood"], ordering: order }),
    );
    expect(col(r.rows, "note")).toEqual(["today"]);
  });

  it("filters a date-only (Date) column by the Tokyo calendar date", async () => {
    const { repo, events } = await make();
    const r = await repo.list(events, params({ filters: { day: "today" }, ordering: order }));
    // The previous and next day are excluded even though UTC "today" would be 2026-10-06.
    expect(col(r.rows, "note")).toEqual(["today", "today, no due"]);
  });

  it("filters a date-only string column by the Tokyo calendar date", async () => {
    const { repo, events } = await make();
    const r = await repo.list(events, params({ filters: { due: "today" }, ordering: order }));
    // Previous day, next day and the null row are excluded.
    expect(col(r.rows, "note")).toEqual(["today"]);
    expect(r.rows[0]?.due).toBe("2026-10-07");
  });

  it("round-trips date-only values through create and update", async () => {
    const { repo, events } = await make();
    const row = await repo.create(events, {
      day: new Date("2026-12-31T00:00:00Z"),
      due: "2026-12-31",
    });
    expect(row.day).toEqual(new Date("2026-12-31T00:00:00Z"));
    expect(row.due).toBe("2026-12-31");
    const updated = await repo.update(events, String(row.id), { due: null });
    expect(updated?.due).toBeNull();
  });
});
