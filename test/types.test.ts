import { describe, expect, it } from "vitest";
import type { ColumnKey, ModelAdminOptions, Row } from "../src/index.js";
import { createAdmin } from "../src/index.js";
import type { authors } from "./fixtures/schema-sqlite.js";

type Authors = typeof authors;

describe("ModelAdminOptions column keys (checked by pnpm typecheck)", () => {
  it("accepts a fully valid options object", () => {
    const options: ModelAdminOptions<Authors> = {
      slug: "authors",
      label: "Authors",
      listDisplay: ["id", "name"],
      listDisplayLinks: ["name"],
      searchFields: ["name", "email"],
      listFilter: ["active", "role"],
      ordering: ["name", "-createdAt"],
      listPerPage: 25,
      fields: ["name", "email"],
      exclude: ["createdAt"],
      readonlyFields: ["id"],
      fieldsets: [{ title: "Main", fields: ["name", "email"] }],
      widgets: { email: "text", active: "checkbox" },
      formatters: { name: (value, row) => `${String(value)} (${row.id})` },
      toString: (row) => row.name,
      validate: (data) => (data.name === "" ? { name: "required" } : undefined),
      hooks: {
        beforeSave: (data, ctx) => (ctx.mode === "add" ? data : { ...data }),
        afterSave: (row, ctx) => void [row.id, ctx.user.id, ctx.db],
        beforeDelete: async (row) => void row.id,
      },
      permissions: { view: true, delete: (user) => user.id === "1" },
      actions: [{ name: "noop", label: "Noop", run: async () => ({ message: "ok" }) }],
    };
    expect(options.slug).toBe("authors");
  });

  it("rejects nonexistent column names", () => {
    const options: ModelAdminOptions<Authors>[] = [
      // @ts-expect-error "nope" is not a column of authors
      { listDisplay: ["nope"] },
      // @ts-expect-error "-nope" is not a column of authors
      { ordering: ["-nope"] },
      // @ts-expect-error "nope" is not a column of authors
      { widgets: { nope: "text" } },
      // @ts-expect-error "nope" is not a column of authors
      { formatters: { nope: () => "" } },
    ];
    expect(options).toHaveLength(4);
  });

  it("derives ColumnKey and Row from the table", () => {
    const key: ColumnKey<Authors> = "name";
    const row: Pick<Row<Authors>, "id"> = { id: 1 };
    expect([key, row.id]).toEqual(["name", 1]);
  });

  it("createAdmin returns an object with register", () => {
    const admin = createAdmin({
      db: {},
      dialect: "sqlite",
      basePath: "/admin",
      secret: "s".repeat(32),
      auth: { getUser: async () => null },
    });
    expect(typeof admin.register).toBe("function");
  });
});

describe("runtime exports of src/index.ts", () => {
  it("export createAdmin only", async () => {
    expect(Object.keys(await import("../src/index.js"))).toEqual(["createAdmin"]);
  });
});
