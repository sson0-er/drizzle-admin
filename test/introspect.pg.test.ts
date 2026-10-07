import type { Table } from "drizzle-orm";
import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { introspectTable, toSnapshot } from "../src/introspect/index.js";
import { articles, authors, events, kv, tags } from "./fixtures/schema-pg.js";
import * as sqliteSchema from "./fixtures/schema-sqlite.js";

function field(table: Table, key: string) {
  const f = introspectTable(table, "postgres").fields.find((x) => x.key === key);
  if (!f) throw new Error(`no field ${key}`);
  return f;
}

describe("introspectTable (postgres)", () => {
  it.each([
    ["authors", authors],
    ["articles", articles],
    ["kv", kv],
    ["events", events],
    ["tags", tags],
  ])("snapshot of %s", (_name, table) => {
    expect(toSnapshot(introspectTable(table, "postgres"))).toMatchSnapshot();
  });

  it("maps serial to an auto-increment number with a default", () => {
    expect(field(authors, "id")).toMatchObject({
      kind: "number",
      notNull: true,
      hasDefault: true,
      isPrimaryKey: true,
      isAutoIncrement: true,
      isInteger: true,
    });
  });

  it("maps a pgEnum column to enum with its values", () => {
    const mood = field(events, "mood");
    expect(mood.kind).toBe("enum");
    expect(mood.enumValues).toEqual(["calm", "busy"]);
    expect(field(authors, "role").enumValues).toEqual(["admin", "editor", "viewer"]);
  });

  it("flags text as long text and varchar as not", () => {
    expect(field(tags, "description")).toMatchObject({ kind: "string", isLongText: true });
    expect(field(tags, "label")).toMatchObject({ kind: "string", isLongText: false });
  });

  it("maps uuid().defaultRandom() to a string with a default and no autoincrement", () => {
    expect(field(events, "code")).toMatchObject({
      kind: "string",
      hasDefault: true,
      notNull: true,
      isAutoIncrement: false,
    });
  });

  it("maps date() to a date-only string and date({mode:'date'}) to a date-only Date", () => {
    expect(field(events, "due")).toMatchObject({ kind: "string", isDateOnly: true });
    expect(field(events, "day")).toMatchObject({ kind: "date", isDateOnly: true });
    expect(field(authors, "createdAt")).toMatchObject({ kind: "date", isDateOnly: false });
  });

  it("treats an identity primary key as auto-increment", () => {
    expect(introspectTable(tags, "postgres").pk).toMatchObject({
      key: "id",
      isAutoIncrement: true,
      hasDefault: true,
    });
  });

  it("maps bigint, json and timestamp", () => {
    expect(field(articles, "big").kind).toBe("bigint");
    expect(field(articles, "meta").kind).toBe("json");
    expect(field(articles, "publishedAt").kind).toBe("date");
  });

  it("records single-column foreign keys by referenced property key", () => {
    const fk = field(articles, "authorId").foreignKey;
    expect(fk?.table).toBe(authors);
    expect(fk?.column).toBe("id");
  });

  it("rejects a SQLite table", () => {
    expect(() => introspectTable(sqliteSchema.authors, "postgres")).toThrow(
      'drizzle-admin: table "authors" is not a PostgreSQL table but dialect is "postgres"',
    );
  });

  it("rejects a table without a primary key", () => {
    const t = pgTable("nopk", { a: text("a") });
    expect(() => introspectTable(t, "postgres")).toThrow('table "nopk" has no primary key');
  });

  it("rejects a composite primary key", () => {
    const t = pgTable("pairs", { a: integer("a").notNull(), b: integer("b").notNull() }, (x) => [
      primaryKey({ columns: [x.a, x.b] }),
    ]);
    expect(() => introspectTable(t, "postgres")).toThrow(
      'table "pairs" has a composite primary key (a, b); composite keys are not supported',
    );
  });
});
