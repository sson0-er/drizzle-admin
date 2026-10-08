import { blob, integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { createAdmin, resolvedModels } from "../src/admin.js";
import { allowedWidgets } from "../src/forms/fields.js";
import type { ModelAdminOptions } from "../src/index.js";
import type { FieldMeta } from "../src/introspect/index.js";
import type { AdminConfig, WidgetType } from "../src/types.js";
import * as pg from "./fixtures/schema-pg.js";
import { articles, authors, kv } from "./fixtures/schema-sqlite.js";

const base: AdminConfig = {
  db: {},
  dialect: "sqlite",
  basePath: "/admin",
  secret: "s".repeat(32),
  auth: { verifyCredentials: async () => null },
};

const sqliteAdmin = () => createAdmin(base);
const pgAdmin = () => createAdmin({ ...base, dialect: "postgres" });

// A table with a column of kind "unknown" (a Buffer blob).
const raw = sqliteTable("raw", {
  id: integer("id").primaryKey(),
  data: blob("data"),
});

// Options are intentionally invalid at the type level in several tests below.
// biome-ignore lint/suspicious/noExplicitAny: tests pass deliberately invalid options
type AnyOptions = any;

function registerError(
  table: Parameters<ReturnType<typeof createAdmin>["register"]>[0],
  options: AnyOptions,
  dialect: "sqlite" | "postgres" = "sqlite",
): string {
  const admin = createAdmin({ ...base, dialect });
  try {
    admin.register(table, options);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected register() to throw");
}

describe("register: unknown columns", () => {
  it.each([
    ["listDisplay", { listDisplay: ["nope"] }, "nope"],
    ["listDisplayLinks", { listDisplayLinks: ["nope"] }, "nope"],
    ["searchFields", { searchFields: ["nope"] }, "nope"],
    ["listFilter", { listFilter: ["nope"] }, "nope"],
    ["ordering", { ordering: ["-nope"] }, "nope"],
    ["fields", { fields: ["nope"] }, "nope"],
    ["exclude", { exclude: ["nope"] }, "nope"],
    ["readonlyFields", { readonlyFields: ["nope"] }, "nope"],
    ["fieldsets", { fieldsets: [{ fields: ["name"] }, { fields: ["nope"] }] }, "nope"],
    ["widgets", { widgets: { nope: "text" } }, "nope"],
    ["formatters", { formatters: { nope: () => "" } }, "nope"],
  ])("%s", (option, options, key) => {
    expect(registerError(authors, options)).toBe(
      `drizzle-admin: authors: option "${option}" references unknown column "${key}"`,
    );
  });

  it("accepts a descending ordering on a known column", () => {
    const admin = sqliteAdmin();
    admin.register(authors, { ordering: ["name", "-createdAt"] });
    expect(resolvedModels(admin).get("authors")?.ordering).toEqual([
      { key: "name", desc: false },
      { key: "createdAt", desc: true },
    ]);
  });
});

describe("register: slugs", () => {
  it("rejects a duplicate slug", () => {
    const admin = sqliteAdmin();
    admin.register(authors);
    expect(() => admin.register(authors)).toThrow('slug "authors" is already registered');
    expect(() => admin.register(kv, { slug: "authors" })).toThrow("already registered");
  });

  it.each(["login", "logout", "static"])("rejects the reserved slug %s", (slug) => {
    expect(registerError(authors, { slug })).toContain(`slug "${slug}" is reserved`);
  });

  it("rejects the reserved slug _lang with the exact message", () => {
    expect(registerError(authors, { slug: "_lang" })).toBe(
      'drizzle-admin: authors: slug "_lang" is reserved',
    );
  });

  it("accepts the slug lang", () => {
    const admin = sqliteAdmin();
    admin.register(kv, { slug: "lang" });
    expect([...resolvedModels(admin).keys()]).toEqual(["lang"]);
  });

  it.each(["a b", "a/b", "ä", "a.b", ""])("rejects the invalid slug %j", (slug) => {
    expect(registerError(authors, { slug })).toContain("may contain only letters, digits");
  });

  it("accepts a custom slug", () => {
    const admin = sqliteAdmin();
    admin.register(authors, { slug: "Staff_1-x" });
    expect([...resolvedModels(admin).keys()]).toEqual(["Staff_1-x"]);
  });
});

describe("register: option checks", () => {
  it("rejects listFilter on a string field and accepts boolean, enum, date and FK", () => {
    expect(registerError(authors, { listFilter: ["name"] })).toContain(
      'listFilter "name" must be a boolean, enum, date or foreign key column',
    );
    const admin = sqliteAdmin();
    admin.register(authors, { listFilter: ["active", "role", "createdAt"] });
    admin.register(articles, { listFilter: ["authorId"] });
  });

  it("rejects searchFields on a number field and accepts string and enum", () => {
    expect(registerError(articles, { searchFields: ["views"] })).toContain(
      'searchFields "views" must be a string or enum column',
    );
    const admin = sqliteAdmin();
    admin.register(authors, { searchFields: ["name", "role"] });
  });

  it("rejects fields together with fieldsets", () => {
    expect(
      registerError(authors, { fields: ["name"], fieldsets: [{ fields: ["name"] }] }),
    ).toContain('options "fields" and "fieldsets" cannot both be set');
  });

  it("rejects duplicate, empty and delete_selected action names", () => {
    const action = (name: string) => ({ name, label: name, run: async () => {} });
    expect(registerError(authors, { actions: [action("a"), action("a")] })).toContain(
      'duplicate action name "a"',
    );
    expect(registerError(authors, { actions: [action("")] })).toContain(
      "action name must be a non-empty string",
    );
    expect(registerError(authors, { actions: [action("delete_selected")] })).toContain(
      'action name "delete_selected" is reserved',
    );
    const admin = sqliteAdmin();
    admin.register(authors, { actions: [action("a"), action("b")] });
    expect(resolvedModels(admin).get("authors")?.actions).toHaveLength(2);
  });

  it.each([0, 1.5, -1, 501])("rejects listPerPage %s", (listPerPage) => {
    expect(registerError(authors, { listPerPage })).toBe(
      "drizzle-admin: authors: listPerPage must be a positive integer of at most 500",
    );
  });

  it("accepts listPerPage up to the selection cap", () => {
    const admin = sqliteAdmin();
    admin.register(authors, { listPerPage: 500 });
    expect(resolvedModels(admin).get("authors")?.listPerPage).toBe(500);
  });

  it("propagates the dialect mismatch and no-primary-key errors from introspection", () => {
    expect(() => sqliteAdmin().register(pg.authors)).toThrow(
      'drizzle-admin: table "authors" is not a SQLite table but dialect is "sqlite"',
    );
    expect(() => pgAdmin().register(authors)).toThrow("but dialect is");
  });

  it("propagates the composite primary key error", () => {
    const pairs = sqliteTable(
      "pairs",
      { a: integer("a").notNull(), b: integer("b").notNull() },
      (t) => [primaryKey({ columns: [t.a, t.b] })],
    );
    expect(() => sqliteAdmin().register(pairs)).toThrow("composite primary key");
  });
});

describe("allowedWidgets", () => {
  const field = (over: Partial<FieldMeta>): FieldMeta => ({
    key: "k",
    dbName: "k",
    kind: "string",
    notNull: false,
    hasDefault: false,
    isPrimaryKey: false,
    isAutoIncrement: false,
    isInteger: false,
    isLongText: false,
    isDateOnly: false,
    isGenerated: false,
    ...over,
  });
  const fk = { table: authors, column: "id" };

  it.each<[string, Partial<FieldMeta>, WidgetType[]]>([
    ["fk number", { kind: "number", foreignKey: fk }, ["select", "number", "hidden"]],
    ["fk bigint", { kind: "bigint", foreignKey: fk }, ["select", "number", "hidden"]],
    ["fk string", { kind: "string", foreignKey: fk }, ["select", "text", "hidden"]],
    ["enum", { kind: "enum" }, ["select", "text", "hidden"]],
    ["boolean", { kind: "boolean" }, ["checkbox"]],
    ["string date-only", { kind: "string", isDateOnly: true }, ["date", "text", "hidden"]],
    ["string", { kind: "string" }, ["text", "textarea", "password", "hidden"]],
    ["number", { kind: "number" }, ["number", "text", "hidden"]],
    ["bigint", { kind: "bigint" }, ["number", "text", "hidden"]],
    ["date date-only", { kind: "date", isDateOnly: true }, ["date", "text", "hidden"]],
    ["date", { kind: "date" }, ["datetime", "text", "hidden"]],
    ["json", { kind: "json" }, ["json", "textarea"]],
    ["unknown", { kind: "unknown" }, []],
  ])("%s", (_name, over, expected) => {
    expect(allowedWidgets(field(over))).toEqual(expected);
  });

  it("a foreign key wins over the kind", () => {
    expect(allowedWidgets(field({ kind: "boolean", foreignKey: fk }))).toEqual([
      "select",
      "text",
      "hidden",
    ]);
  });
});

describe("register: widget overrides", () => {
  const rejected = (
    table: Parameters<typeof registerError>[0],
    key: string,
    widget: string,
    kind: string,
    dialect: "sqlite" | "postgres" = "sqlite",
  ) =>
    expect(registerError(table, { widgets: { [key]: widget } }, dialect)).toContain(
      `widget "${widget}" is not allowed for field "${key}" (kind ${kind})`,
    );
  const accepted = (
    table: Parameters<typeof registerError>[0],
    key: string,
    widget: string,
    dialect: "sqlite" | "postgres" = "sqlite",
  ) => {
    const admin = createAdmin({ ...base, dialect });
    admin.register(table, { widgets: { [key]: widget } } as AnyOptions);
    const model = [...resolvedModels(admin).values()][0];
    expect(model?.widgets[key]).toBe(widget);
  };

  it("foreign key", () => {
    rejected(articles, "authorId", "checkbox", "number");
    accepted(articles, "authorId", "number");
    accepted(articles, "authorId", "hidden");
    // `select` is accepted at registration; its target is checked at finalization.
    accepted(articles, "authorId", "select");
  });
  it("enum", () => {
    rejected(authors, "role", "textarea", "enum");
    accepted(authors, "role", "select");
  });
  it("boolean", () => {
    rejected(authors, "active", "text", "boolean");
    accepted(authors, "active", "checkbox");
  });
  it("string", () => {
    rejected(authors, "name", "checkbox", "string");
    accepted(authors, "name", "textarea");
    accepted(authors, "name", "password");
  });
  it("number and bigint", () => {
    rejected(articles, "views", "textarea", "number");
    accepted(articles, "views", "number");
    rejected(articles, "big", "datetime", "bigint");
    accepted(articles, "big", "text");
  });
  it("date", () => {
    rejected(authors, "createdAt", "date", "date");
    accepted(authors, "createdAt", "datetime");
  });
  it("date-only date (PgDate)", () => {
    rejected(pg.events, "day", "datetime", "date", "postgres");
    accepted(pg.events, "day", "date", "postgres");
  });
  it("json", () => {
    rejected(articles, "meta", "text", "json");
    accepted(articles, "meta", "textarea");
    accepted(articles, "meta", "json");
  });
  it("unknown", () => {
    rejected(raw, "data", "text", "unknown");
  });

  it("PG date() string mode: listFilter and date accepted, textarea rejected", () => {
    const admin = pgAdmin();
    admin.register(pg.events, { listFilter: ["due"], widgets: { due: "date" } });
    expect(resolvedModels(admin).get("events")?.listFilter).toEqual(["due"]);
    rejected(pg.events, "due", "textarea", "string", "postgres");
    rejected(pg.events, "due", "password", "string", "postgres");
  });
});

describe("finalization", () => {
  it("throws on register after admin.app was accessed", () => {
    const admin = sqliteAdmin();
    admin.register(authors);
    void admin.app;
    expect(() => admin.register(kv)).toThrow(
      "register() must be called before admin.app / admin.fetch is used",
    );
  });

  it("throws on register after admin.fetch was called", async () => {
    const admin = sqliteAdmin();
    await admin.fetch(new Request("http://localhost/admin/"));
    expect(() => admin.register(kv)).toThrow("register() must be called before");
  });

  it("returns the same app instance on repeated access", () => {
    const admin = sqliteAdmin();
    admin.register(authors);
    expect(admin.app).toBe(admin.app);
  });

  it("sets foreignKey.slug when the referenced table is registered", () => {
    const admin = sqliteAdmin();
    admin.register(articles);
    admin.register(authors, { slug: "people" });
    void admin.app;
    const field = resolvedModels(admin)
      .get("articles")
      ?.meta.fields.find((f) => f.key === "authorId");
    expect(field?.foreignKey?.slug).toBe("people");
  });

  it("leaves foreignKey.slug unset when the referenced table is not registered", () => {
    const admin = sqliteAdmin();
    admin.register(articles);
    void admin.app;
    const field = resolvedModels(admin)
      .get("articles")
      ?.meta.fields.find((f) => f.key === "authorId");
    expect(field?.foreignKey?.slug).toBeUndefined();
  });

  it("rejects an FK listFilter to an unregistered table on first app access", () => {
    const admin = sqliteAdmin();
    admin.register(articles, { listFilter: ["authorId"] });
    expect(() => admin.app).toThrow(
      'articles: listFilter "authorId" needs the referenced table to be registered',
    );
    expect(() => admin.app).toThrow("needs the referenced table to be registered");
  });

  it("rejects widget select on an FK to an unregistered table", () => {
    const admin = sqliteAdmin();
    admin.register(articles, { widgets: { authorId: "select" } });
    expect(() => admin.app).toThrow(
      'widget "select" for "authorId" needs the referenced table to be registered',
    );
  });

  it("accepts FK listFilter and select once the referenced table is registered", () => {
    const admin = sqliteAdmin();
    admin.register(articles, { listFilter: ["authorId"], widgets: { authorId: "select" } });
    admin.register(authors);
    expect(() => admin.app).not.toThrow();
  });

  it("serves requests through fetch, mounted at the prefix", async () => {
    // External auth: the point is that fetch works, so no login is needed to reach the fallback.
    const admin = createAdmin({ ...base, auth: { getUser: async () => ({ id: "1", name: "u" }) } });
    admin.register(authors);
    const response = await admin.fetch(new Request("http://localhost/admin/anything/"));
    // An unknown slashed path reaches the fallback route; the point is that fetch works.
    expect(response.status).toBe(404);
  });
});

describe("ResolvedModel defaults", () => {
  it("resolves defaults for a bare registration", () => {
    const admin = sqliteAdmin();
    admin.register(articles);
    const model = resolvedModels(admin).get("articles");
    expect(model).toBeDefined();
    if (!model) return;
    expect(model.slug).toBe("articles");
    expect(model.label).toBe("articles");
    expect(model.listDisplay).toEqual(["id", "title", "body", "authorId", "publishedAt"]);
    expect(model.listDisplayLinks).toEqual(["id"]);
    expect(model.searchFields).toEqual([]);
    expect(model.listFilter).toEqual([]);
    expect(model.ordering).toEqual([]);
    expect(model.listPerPage).toBe(50);
    expect(model.fieldsets).toEqual([
      {
        fields: ["id", "title", "body", "authorId", "publishedAt", "meta", "views", "score", "big"],
      },
    ]);
    expect(model.readonlyFields.size).toBe(0);
    expect(model.toString({ id: 7 })).toBe("articles #7");
    expect(model.hooks).toEqual({});
    expect(model.actions).toEqual([]);
    for (const permission of ["view", "add", "change", "delete"] as const) {
      expect(model.permissions[permission]({ id: "1", name: "n" })).toBe(true);
    }
  });

  it("keeps a table with fewer than five columns whole", () => {
    const admin = sqliteAdmin();
    admin.register(kv);
    expect(resolvedModels(admin).get("kv")?.listDisplay).toEqual(["key", "value"]);
  });

  it("applies options and exclude", () => {
    const admin = sqliteAdmin();
    const display = (row: { name: string }) => row.name;
    admin.register(authors, {
      label: "Writers",
      listDisplay: ["name", "email"],
      exclude: ["createdAt", "role"],
      readonlyFields: ["email"],
      toString: display,
    });
    const model = resolvedModels(admin).get("authors");
    expect(model?.label).toBe("Writers");
    expect(model?.listDisplay).toEqual(["name", "email"]);
    expect(model?.listDisplayLinks).toEqual(["name"]);
    expect(model?.fieldsets).toEqual([{ fields: ["id", "name", "email", "active"] }]);
    expect([...(model?.readonlyFields ?? [])]).toEqual(["email"]);
    expect(model?.toString({ name: "x" })).toBe("x");
  });

  it("uses fields order and applies exclude to fields and fieldsets", () => {
    const admin = sqliteAdmin();
    admin.register(authors, { fields: ["email", "name", "role"], exclude: ["role"] });
    admin.register(kv, {
      fieldsets: [{ title: "T", fields: ["key", "value"] }, { fields: ["value"] }],
      exclude: ["value"],
    });
    expect(resolvedModels(admin).get("authors")?.fieldsets).toEqual([
      { fields: ["email", "name"] },
    ]);
    expect(resolvedModels(admin).get("kv")?.fieldsets).toEqual([
      { title: "T", fields: ["key"] },
      { fields: [] },
    ]);
  });

  it("default toString uses the label", () => {
    const admin = sqliteAdmin();
    admin.register(authors, { label: "Author" });
    expect(resolvedModels(admin).get("authors")?.toString({ id: 3 })).toBe("Author #3");
  });

  it("normalizes permissions: boolean, function and undefined (unset delete inherits view)", () => {
    const admin = sqliteAdmin();
    const user = { id: "1", name: "n" };
    admin.register(authors, {
      permissions: { view: false, add: true, change: (u) => u.id === "1" },
    });
    const { permissions } = resolvedModels(admin).get("authors") ?? {};
    expect(permissions?.view(user)).toBe(false);
    expect(permissions?.add(user)).toBe(true);
    expect(permissions?.change(user)).toBe(true);
    expect(permissions?.change({ id: "2", name: "n" })).toBe(false);
    expect(permissions?.delete(user)).toBe(false);
  });

  it("keeps registration order", () => {
    const admin = sqliteAdmin();
    admin.register(kv);
    admin.register(authors);
    expect([...resolvedModels(admin).keys()]).toEqual(["kv", "authors"]);
  });
});

describe("register: default listDisplay skips exclude (decision 046)", () => {
  const columns = [
    "id",
    "title",
    "body",
    "authorId",
    "publishedAt",
    "meta",
    "views",
    "score",
    "big",
  ] as const;
  it.each<{
    name: string;
    options: ModelAdminOptions<typeof articles>;
    listDisplay: string[];
    links: string[];
  }>([
    {
      name: "an excluded non-key column",
      options: { exclude: ["title"] },
      listDisplay: ["id", "body", "authorId", "publishedAt", "meta"],
      links: ["id"],
    },
    {
      name: "an excluded primary key",
      options: { exclude: ["id"] },
      listDisplay: ["title", "body", "authorId", "publishedAt", "meta"],
      links: ["title"],
    },
    {
      name: "every column excluded",
      options: { exclude: [...columns] },
      listDisplay: ["id"],
      links: ["id"],
    },
    {
      name: "an explicit listDisplay is not filtered",
      options: { listDisplay: ["id", "title"], exclude: ["title"] },
      listDisplay: ["id", "title"],
      links: ["id"],
    },
  ])("$name", ({ options, listDisplay, links }) => {
    const admin = sqliteAdmin();
    admin.register(articles, options);
    const model = resolvedModels(admin).get("articles");
    expect(model?.listDisplay).toEqual(listDisplay);
    expect(model?.listDisplayLinks).toEqual(links);
  });
});

describe("register: permission inheritance (decision 043)", () => {
  const users = [
    { id: "1", name: "n" },
    { id: "2", name: "n" },
  ];
  const perms = ["view", "add", "change", "delete"] as const;
  const byId = (u: { id: string }) => u.id === "1";

  it.each([
    { name: "{}", permissions: {}, expected: [true, true, true, true] },
    { name: "view false", permissions: { view: false }, expected: [false, false, false, false] },
    {
      name: "view false, add true",
      permissions: { view: false, add: true },
      expected: [false, true, false, false],
    },
    {
      name: "view false, delete true",
      permissions: { view: false, delete: true },
      expected: [false, false, false, true],
    },
  ])("$name", ({ permissions, expected }) => {
    const admin = sqliteAdmin();
    admin.register(authors, { permissions });
    const model = resolvedModels(admin).get("authors");
    expect(perms.map((p) => model?.permissions[p](users[0] as never))).toEqual(expected);
  });

  it.each(users)("unset write permissions follow a view function for user $id", (user) => {
    const admin = sqliteAdmin();
    admin.register(authors, { permissions: { view: byId } });
    const model = resolvedModels(admin).get("authors");
    const expected = byId(user);
    expect(perms.map((p) => model?.permissions[p](user))).toEqual([
      expected,
      expected,
      expected,
      expected,
    ]);
  });
});

describe("register: password widget restrictions", () => {
  it.each([
    {
      name: "the primary key",
      table: kv,
      options: { widgets: { key: "password" } },
      message: 'kv: the primary key "key" cannot use the password widget',
    },
    {
      name: "a searchFields entry",
      table: authors,
      options: { widgets: { name: "password" }, searchFields: ["name"] },
      message: 'authors: field "name" uses the password widget and cannot be in searchFields',
    },
    {
      name: "an ascending ordering entry",
      table: authors,
      options: { widgets: { name: "password" }, ordering: ["name"] },
      message: 'authors: field "name" uses the password widget and cannot be in ordering',
    },
    {
      name: "a descending ordering entry",
      table: authors,
      options: { widgets: { name: "password" }, ordering: ["-name"] },
      message: 'authors: field "name" uses the password widget and cannot be in ordering',
    },
  ])("rejects the widget on $name", ({ table, options, message }) => {
    expect(registerError(table, options)).toBe(`drizzle-admin: ${message}`);
  });

  it("checks every widget against allowedWidgets before the password restrictions", () => {
    expect(registerError(kv, { widgets: { key: "password", value: "checkbox" } })).toBe(
      'drizzle-admin: kv: widget "checkbox" is not allowed for field "value" (kind string)',
    );
  });

  it("accepts the widget on a field outside searchFields and ordering", () => {
    expect(() =>
      sqliteAdmin().register(authors, {
        widgets: { name: "password" },
        searchFields: ["email"],
        ordering: ["-email"],
      }),
    ).not.toThrow();
  });
});
