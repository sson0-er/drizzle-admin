import { and, type SQL, type Table } from "drizzle-orm";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { asQueryDb } from "../src/data/db.js";
import {
  buildFilters,
  buildOrderBy,
  buildSearch,
  escapeLike,
  parseFieldValue,
  parsePk,
} from "../src/data/query.js";
import { type FieldMeta, introspectTable, type ModelMeta } from "../src/introspect/index.js";
import * as pg from "./fixtures/schema-pg.js";
import * as sqlite from "./fixtures/schema-sqlite.js";

const pgDb = drizzlePg.mock();
const sqliteDb = drizzleSqlite.mock();

const pgMeta = (table: Table) => introspectTable(table, "postgres");
const sqliteMeta = (table: Table) => introspectTable(table, "sqlite");

// Renders a condition list through a real drizzle select, the way the repository uses it.
function whereSql(db: typeof pgDb | typeof sqliteDb, table: Table, where: SQL | undefined) {
  return asQueryDb(db).select().from(table).where(where).toSQL() as {
    sql: string;
    params: unknown[];
  };
}

function field(meta: ModelMeta, key: string): FieldMeta {
  const f = meta.fields.find((x) => x.key === key);
  if (!f) throw new Error(`no field ${key}`);
  return f;
}

const NOW = new Date("2026-10-06T16:00:00Z");
const TOKYO = "Asia/Tokyo";

describe("asQueryDb", () => {
  it("returns the same object", () => {
    expect(asQueryDb(pgDb)).toBe(pgDb);
  });
});

describe("escapeLike", () => {
  it.each([
    ["\\", "\\\\"],
    ["%", "\\%"],
    ["_", "\\_"],
    ["plain", "plain"],
    ["100%_a\\b", "100\\%\\_a\\\\b"],
  ])("escapes %j", (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});

describe("buildSearch", () => {
  it("postgres casts every column to text and uses ilike with a parameter", () => {
    const meta = pgMeta(pg.events);
    const q = whereSql(
      pgDb,
      pg.events,
      buildSearch(meta, ["note", "code", "amount", "mood"], "a_b", "postgres"),
    );
    expect(q.sql).toBe(
      'select "id", "day", "code", "amount", "mood", "note", "due" from "events" where ' +
        '("events"."note"::text ilike $1 or "events"."code"::text ilike $2 or ' +
        '"events"."amount"::text ilike $3 or "events"."mood"::text ilike $4)',
    );
    expect(q.params).toEqual(["%a\\_b%", "%a\\_b%", "%a\\_b%", "%a\\_b%"]);
  });

  it("sqlite uses like with an explicit escape and a parameter", () => {
    const meta = sqliteMeta(sqlite.authors);
    const q = whereSql(
      sqliteDb,
      sqlite.authors,
      buildSearch(meta, ["name", "email"], " 100% ", "sqlite"),
    );
    expect(q.sql).toContain(
      `("authors"."name" like ? escape '\\' or "authors"."email" like ? escape '\\')`,
    );
    expect(q.params).toEqual(["%100\\%%", "%100\\%%"]);
  });

  it("returns undefined for empty or blank q and for empty searchFields", () => {
    const meta = pgMeta(pg.authors);
    expect(buildSearch(meta, ["name"], undefined, "postgres")).toBeUndefined();
    expect(buildSearch(meta, ["name"], "", "postgres")).toBeUndefined();
    expect(buildSearch(meta, ["name"], "   ", "postgres")).toBeUndefined();
    expect(buildSearch(meta, [], "x", "postgres")).toBeUndefined();
    expect(buildSearch(sqliteMeta(sqlite.authors), [], "x", "sqlite")).toBeUndefined();
  });
});

function filterSql(
  db: typeof pgDb | typeof sqliteDb,
  table: Table,
  meta: ModelMeta,
  filters: Record<string, string>,
) {
  const conditions = buildFilters(meta, filters, TOKYO, NOW);
  return {
    conditions,
    q: whereSql(db, table, conditions.length ? and(...conditions) : undefined),
  };
}

describe("buildFilters: dates", () => {
  it("kind-date date-only field binds UTC-midnight ISO strings", () => {
    const meta = pgMeta(pg.events);
    const { q } = filterSql(pgDb, pg.events, meta, { day: "today" });
    expect(q.sql).toContain('"events"."day" >= $1 and "events"."day" < $2');
    expect(q.params).toEqual(["2026-10-07T00:00:00.000Z", "2026-10-08T00:00:00.000Z"]);
  });

  it("date-only string field binds YYYY-MM-DD strings", () => {
    const meta = pgMeta(pg.events);
    const { q } = filterSql(pgDb, pg.events, meta, { due: "today" });
    expect(q.sql).toContain('"events"."due" >= $1 and "events"."due" < $2');
    expect(q.params).toEqual(["2026-10-07", "2026-10-08"]);
  });

  it("timestamp field binds the time-zone instants", () => {
    const meta = pgMeta(pg.articles);
    const { q } = filterSql(pgDb, pg.articles, meta, { publishedAt: "today" });
    // Tokyo midnight of 2026-10-07 is 2026-10-06T15:00Z.
    expect(q.params).toEqual(["2026-10-06T15:00:00.000Z", "2026-10-07T15:00:00.000Z"]);
  });

  it("sqlite timestamp field binds numeric instants for each preset", () => {
    const meta = sqliteMeta(sqlite.articles);
    const { q } = filterSql(sqliteDb, sqlite.articles, meta, { publishedAt: "month" });
    // Tokyo 2026-10-01T00:00 to 2026-11-01T00:00, in epoch ms.
    expect(q.params).toEqual([Date.UTC(2026, 8, 30, 15), Date.UTC(2026, 9, 31, 15)]);
  });

  it.each([
    ["today", ["2026-10-06T15:00:00.000Z", "2026-10-07T15:00:00.000Z"]],
    ["past7", ["2026-09-30T15:00:00.000Z", "2026-10-07T15:00:00.000Z"]],
    ["month", ["2026-09-30T15:00:00.000Z", "2026-10-31T15:00:00.000Z"]],
    ["year", ["2025-12-31T15:00:00.000Z", "2026-12-31T15:00:00.000Z"]],
  ])("timestamp field binds the hard-coded bounds of the %s preset", (preset, params) => {
    const { q } = filterSql(pgDb, pg.articles, pgMeta(pg.articles), { publishedAt: preset });
    expect(q.sql).toContain('"articles"."published_at" >= $1 and "articles"."published_at" < $2');
    expect(q.params).toEqual(params);
  });

  it("a date field that is also a foreign key still filters by preset range, not equality", () => {
    const base = pgMeta(pg.articles);
    const publishedAt = {
      ...field(base, "publishedAt"),
      foreignKey: { table: pg.authors, column: "id" },
    };
    const meta: ModelMeta = {
      ...base,
      fields: base.fields.map((f) => (f.key === "publishedAt" ? publishedAt : f)),
    };
    const { q } = filterSql(pgDb, pg.articles, meta, { publishedAt: "today" });
    expect(q.sql).toContain('"articles"."published_at" >= $1 and "articles"."published_at" < $2');
    expect(q.params).toEqual(["2026-10-06T15:00:00.000Z", "2026-10-07T15:00:00.000Z"]);
  });

  it("ignores an unknown preset", () => {
    const meta = pgMeta(pg.events);
    expect(buildFilters(meta, { day: "decade", due: "", publishedAt: "x" }, TOKYO, NOW)).toEqual(
      [],
    );
  });
});

describe("buildFilters: boolean, enum, FK", () => {
  it("boolean 1 and 0 bind true and false", () => {
    const meta = sqliteMeta(sqlite.authors);
    const one = filterSql(sqliteDb, sqlite.authors, meta, { active: "1" });
    const zero = filterSql(sqliteDb, sqlite.authors, meta, { active: "0" });
    expect(one.q.sql).toContain('"active" = ?');
    expect(one.q.params).toEqual([1]);
    expect(zero.q.params).toEqual([0]);
  });

  it("enum value binds the value", () => {
    const meta = pgMeta(pg.authors);
    const { q } = filterSql(pgDb, pg.authors, meta, { role: "editor" });
    expect(q.sql).toContain('"role" = $1');
    expect(q.params).toEqual(["editor"]);
  });

  it("FK value binds the parsed number", () => {
    const meta = sqliteMeta(sqlite.articles);
    const { q } = filterSql(sqliteDb, sqlite.articles, meta, { authorId: "12" });
    expect(q.sql).toContain('"author_id" = ?');
    expect(q.params).toEqual([12]);
  });

  it("invalid values add no condition", () => {
    const authors = sqliteMeta(sqlite.authors);
    const articles = sqliteMeta(sqlite.articles);
    expect(buildFilters(authors, { active: "2" }, TOKYO, NOW)).toEqual([]);
    expect(buildFilters(authors, { active: "" }, TOKYO, NOW)).toEqual([]);
    expect(buildFilters(authors, { role: "root" }, TOKYO, NOW)).toEqual([]);
    expect(buildFilters(articles, { authorId: "abc" }, TOKYO, NOW)).toEqual([]);
    expect(buildFilters(articles, { authorId: "1.5" }, TOKYO, NOW)).toEqual([]);
    expect(buildFilters(articles, { publishedAt: "forever" }, TOKYO, NOW)).toEqual([]);
  });

  it("ignores keys that are not fields", () => {
    expect(buildFilters(sqliteMeta(sqlite.authors), { nope: "1" }, TOKYO, NOW)).toEqual([]);
  });
});

describe("buildOrderBy", () => {
  it("appends the PK ascending when absent", () => {
    const meta = pgMeta(pg.authors);
    const q = pgDb
      .select()
      .from(pg.authors)
      .orderBy(...buildOrderBy(meta, [{ key: "name", desc: true }]))
      .toSQL();
    expect(q.sql).toContain('order by "authors"."name" desc, "authors"."id" asc');
    expect(q.sql).not.toContain('"authors"."id" desc');
  });

  it("throws for a key that is not a column", () => {
    expect(() => buildOrderBy(pgMeta(pg.authors), [{ key: "nope", desc: false }])).toThrow(
      'drizzle-admin: unknown column "nope" on "authors"',
    );
  });

  it("appends the PK for an empty ordering", () => {
    const meta = pgMeta(pg.authors);
    expect(buildOrderBy(meta, [])).toHaveLength(1);
  });

  it("does not append the PK when already present", () => {
    const meta = sqliteMeta(sqlite.authors);
    const order = buildOrderBy(meta, [
      { key: "id", desc: true },
      { key: "name", desc: false },
    ]);
    expect(order).toHaveLength(2);
    const q = sqliteDb
      .select()
      .from(sqlite.authors)
      .orderBy(...order)
      .toSQL();
    expect(q.sql).toContain('order by "authors"."id" desc, "authors"."name" asc');
  });
});

describe("parsePk / parseFieldValue", () => {
  const articles = sqliteMeta(sqlite.articles);
  const id = field(articles, "id");
  const score = field(articles, "score");
  const big = field(articles, "big");
  const title = field(articles, "title");
  const role = field(sqliteMeta(sqlite.authors), "role");
  const meta = field(articles, "meta");

  it("parses integers", () => {
    expect(parsePk(id, "12")).toBe(12);
    expect(parsePk(id, "-3")).toBe(-3);
    expect(parseFieldValue(id, "12")).toBe(12);
  });

  it("rejects non-integers and unsafe integers for integer fields", () => {
    expect(parsePk(id, "1.5")).toBeNull();
    expect(parsePk(id, "x")).toBeNull();
    expect(parsePk(id, "")).toBeNull();
    expect(parsePk(id, "9007199254740993")).toBeNull();
  });

  it("parses decimals for non-integer number fields", () => {
    expect(parseFieldValue(score, "1.5")).toBe(1.5);
    expect(parseFieldValue(score, "2")).toBe(2);
    expect(parseFieldValue(score, "1e3")).toBeNull();
    expect(parseFieldValue(score, "x")).toBeNull();
  });

  it("parses bigint beyond the safe integer range", () => {
    expect(parsePk(big, "9007199254740993")).toBe(9007199254740993n);
    expect(parsePk(big, "-5")).toBe(-5n);
    expect(parsePk(big, "1.5")).toBeNull();
    expect(parsePk(big, "x")).toBeNull();
  });

  it("returns string and enum values raw", () => {
    expect(parsePk(title, "a b")).toBe("a b");
    expect(parseFieldValue(role, "admin")).toBe("admin");
  });

  describe("value domains", () => {
    const fieldWith = (patch: Partial<FieldMeta>): FieldMeta => ({
      key: "k",
      dbName: "k",
      kind: "number",
      notNull: true,
      hasDefault: false,
      isPrimaryKey: false,
      isAutoIncrement: false,
      isInteger: true,
      isLongText: false,
      isDateOnly: false,
      isGenerated: false,
      ...patch,
    });
    const int16 = fieldWith({ valueCheck: "int16" });
    const int32 = fieldWith({ valueCheck: "int32" });
    const int64 = fieldWith({ kind: "bigint", isInteger: false, valueCheck: "int64" });
    const uuid = fieldWith({ kind: "string", isInteger: false, valueCheck: "uuid" });
    const text = fieldWith({ kind: "string", isInteger: false });
    const enumField = fieldWith({
      kind: "enum",
      isInteger: false,
      enumValues: ["admin", "editor"],
    });
    const uuidValue = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    it.each([
      ["int32 max", int32, "2147483647", 2147483647],
      ["int32 min", int32, "-2147483648", -2147483648],
      ["int32 above max", int32, "2147483648", null],
      ["int32 below min", int32, "-2147483649", null],
      ["int16 max", int16, "32767", 32767],
      ["int16 min", int16, "-32768", -32768],
      ["int16 below min", int16, "-32769", null],
      ["int16 above max", int16, "32768", null],
      ["int64 max", int64, "9223372036854775807", 9223372036854775807n],
      ["int64 above max", int64, "9223372036854775808", null],
      ["int64 below min", int64, "-9223372036854775809", null],
      [
        "bigint without valueCheck has no int8 bound",
        fieldWith({ kind: "bigint", isInteger: false }),
        "9223372036854775808",
        9223372036854775808n,
      ],
      ["integer without valueCheck", fieldWith({}), "3000000000", 3000000000],
      ["uuid", uuid, uuidValue, uuidValue],
      ["uuid upper case", uuid, uuidValue.toUpperCase(), uuidValue.toUpperCase()],
      ["non-uuid", uuid, "abc", null],
      ["braced uuid", uuid, `{${uuidValue}}`, null],
      ["hyphen-less uuid", uuid, uuidValue.replaceAll("-", ""), null],
      ["string with NUL", text, "a\u0000b", null],
      ["plain string", text, "plain", "plain"],
      ["enum member", enumField, "admin", "admin"],
      ["enum non-member", enumField, "root", null],
    ])("%s", (_name, f, raw, expected) => {
      expect(parseFieldValue(f, raw)).toBe(expected);
      expect(parsePk(f, raw)).toBe(expected);
    });
  });

  it("returns null for other kinds", () => {
    expect(parseFieldValue(meta, "{}")).toBeNull();
    expect(parseFieldValue(field(pgMeta(pg.events), "day"), "2026-10-07")).toBeNull();
  });
});
