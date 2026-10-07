import { getTableName, type Table } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { introspectTable, toSnapshot } from "../src/introspect/index.js";
import * as pgSchema from "./fixtures/schema-pg.js";
import { articles, authors, kv } from "./fixtures/schema-sqlite.js";

function field(table: Table, key: string) {
  const f = introspectTable(table, "sqlite").fields.find((x) => x.key === key);
  if (!f) throw new Error(`no field ${key}`);
  return f;
}

describe("introspectTable (sqlite)", () => {
  it.each([
    ["authors", authors],
    ["articles", articles],
    ["kv", kv],
  ])("snapshot of %s", (_name, table) => {
    expect(toSnapshot(introspectTable(table, "sqlite"))).toMatchSnapshot();
  });

  it("maps column kinds", () => {
    expect(field(authors, "name").kind).toBe("string");
    expect(field(authors, "active").kind).toBe("boolean");
    expect(field(authors, "createdAt").kind).toBe("date");
    expect(field(articles, "publishedAt").kind).toBe("date");
    expect(field(articles, "meta").kind).toBe("json");
    expect(field(articles, "views")).toMatchObject({ kind: "number", isInteger: true });
    expect(field(articles, "score")).toMatchObject({ kind: "number", isInteger: false });
    expect(field(articles, "big").kind).toBe("bigint");
    const role = field(authors, "role");
    expect(role.kind).toBe("enum");
    expect(role.enumValues).toEqual(["admin", "editor", "viewer"]);
  });

  it("reports autoincrement primary keys with a default", () => {
    const meta = introspectTable(authors, "sqlite");
    expect(meta.pk.key).toBe("id");
    expect(meta.pk).toMatchObject({
      kind: "number",
      hasDefault: true,
      isPrimaryKey: true,
      isAutoIncrement: true,
    });
    expect(field(authors, "name").isPrimaryKey).toBe(false);
  });

  it("treats a text primary key as not auto-incrementing", () => {
    const meta = introspectTable(kv, "sqlite");
    expect(meta.pk).toMatchObject({ key: "key", kind: "string", isAutoIncrement: false });
  });

  it("records single-column foreign keys by referenced property key", () => {
    const fk = field(articles, "authorId").foreignKey;
    expect(fk?.table).toBe(authors);
    expect(fk?.column).toBe("id");
    expect(field(articles, "title").foreignKey).toBeUndefined();
  });

  it("keeps fields in definition order", () => {
    expect(introspectTable(authors, "sqlite").fields.map((f) => f.key)).toEqual([
      "id",
      "name",
      "email",
      "active",
      "role",
      "createdAt",
    ]);
    expect(getTableName(introspectTable(authors, "sqlite").table)).toBe("authors");
  });

  it("rejects a PostgreSQL table", () => {
    expect(() => introspectTable(pgSchema.authors, "sqlite")).toThrow(
      'drizzle-admin: table "authors" is not a SQLite table but dialect is "sqlite"',
    );
  });

  it("rejects a table without a primary key", () => {
    const t = sqliteTable("nopk", { a: text("a") });
    expect(() => introspectTable(t, "sqlite")).toThrow('table "nopk" has no primary key');
  });

  it("rejects a composite primary key", () => {
    const t = sqliteTable(
      "pairs",
      { a: integer("a").notNull(), b: integer("b").notNull() },
      (x) => [primaryKey({ columns: [x.a, x.b] })],
    );
    expect(() => introspectTable(t, "sqlite")).toThrow(
      'table "pairs" has a composite primary key (a, b); composite keys are not supported',
    );
  });

  it("rejects a composite key declared with column-level primaryKey()", () => {
    const t = sqliteTable("pairs2", {
      a: integer("a").primaryKey(),
      b: integer("b").primaryKey(),
    });
    expect(() => introspectTable(t, "sqlite")).toThrow("composite primary key");
  });

  it("accepts a single-column table-level primary key", () => {
    const t = sqliteTable("one", { a: text("a").notNull() }, (x) => [
      primaryKey({ columns: [x.a] }),
    ]);
    expect(introspectTable(t, "sqlite").pk.key).toBe("a");
  });
});
