import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { createAdmin, resolvedModels } from "../src/admin.js";
import {
  buildFormGroups,
  type Choice,
  editableFields,
  type FormField,
  type FormGroup,
  type FormMode,
} from "../src/forms/fields.js";
import type { AdminConfig, ModelAdminOptions, ResolvedModel } from "../src/types.js";
import * as pg from "./fixtures/schema-pg.js";
import * as sqlite from "./fixtures/schema-sqlite.js";

const base: AdminConfig = {
  db: {},
  dialect: "sqlite",
  basePath: "/admin",
  secret: "s".repeat(32),
  auth: { verifyCredentials: async () => null },
};

// A table with a column of kind "unknown" (a Buffer blob).
const raw = sqliteTable("raw", {
  id: integer("id").primaryKey(),
  data: blob("data"),
});

// A table with a generated column.
const computed = sqliteTable("computed", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  first: text("first").notNull(),
  upper: text("upper").generatedAlwaysAs(sql`upper(first)`),
});

type Registration = [
  table: Parameters<ReturnType<typeof createAdmin>["register"]>[0],
  options?: unknown,
];

/** Registers the given tables and returns the resolved models (FK slugs are resolved). */
function models(dialect: "sqlite" | "postgres", ...registrations: Registration[]) {
  const admin = createAdmin({ ...base, dialect });
  for (const [table, options] of registrations) {
    admin.register(table, options as ModelAdminOptions<typeof table>);
  }
  void admin.app; // finalizes the registry, which resolves `foreignKey.slug`
  return resolvedModels(admin);
}

function modelOf(
  dialect: "sqlite" | "postgres",
  table: Registration[0],
  options?: unknown,
  ...others: Registration[]
): ResolvedModel {
  const all = models(dialect, [table, options], ...others);
  const first = [...all.values()][0];
  if (first === undefined) throw new Error("no model");
  return first;
}

function build(
  model: ResolvedModel,
  over: Partial<{
    mode: FormMode;
    canChange: boolean;
    fkChoices: ReadonlyMap<string, Choice[] | "tooMany" | "noView">;
  }> = {},
): FormGroup[] {
  return buildFormGroups({
    model,
    mode: over.mode ?? "add",
    canChange: over.canChange ?? true,
    prefix: "/admin",
    fkChoices: over.fkChoices ?? new Map(),
    refSlugOf: (key) => model.meta.fields.find((f) => f.key === key)?.foreignKey?.slug,
  });
}

const flat = (groups: FormGroup[]): FormField[] => groups.flatMap((g) => g.fields);
const keys = (groups: FormGroup[]): string[] => flat(groups).map((f) => f.key);
const field = (groups: FormGroup[], key: string): FormField => {
  const found = flat(groups).find((f) => f.key === key);
  if (found === undefined) throw new Error(`no field ${key}`);
  return found;
};

describe("buildFormGroups: editability", () => {
  it("omits an auto-increment PK on add and shows it display-only on change", () => {
    const model = modelOf("sqlite", sqlite.authors);
    expect(keys(build(model, { mode: "add" }))).not.toContain("id");
    const change = field(build(model, { mode: "change" }), "id");
    expect(change.editable).toBe(false);
  });

  it("keeps a non-auto PK editable on add and display-only on change", () => {
    const model = modelOf("sqlite", sqlite.kv);
    expect(field(build(model, { mode: "add" }), "key").editable).toBe(true);
    expect(field(build(model, { mode: "change" }), "key").editable).toBe(false);
    expect(field(build(model, { mode: "change" }), "value").editable).toBe(true);
  });

  it("omits readonlyFields on add and shows them display-only on change", () => {
    const model = modelOf("sqlite", sqlite.authors, { readonlyFields: ["email"] });
    expect(keys(build(model, { mode: "add" }))).not.toContain("email");
    expect(field(build(model, { mode: "change" }), "email").editable).toBe(false);
  });

  it("omits generated fields on add and shows them display-only on change", () => {
    const model = modelOf("sqlite", computed);
    expect(model.meta.fields.find((f) => f.key === "upper")?.isGenerated).toBe(true);
    expect(keys(build(model, { mode: "add" }))).toEqual(["first"]);
    expect(field(build(model, { mode: "change" }), "upper").editable).toBe(false);
  });

  it("omits kind unknown on add and shows it display-only on change", () => {
    const model = modelOf("sqlite", raw);
    expect(keys(build(model, { mode: "add" }))).not.toContain("data");
    expect(field(build(model, { mode: "change" }), "data").editable).toBe(false);
  });

  it("makes other fields display-only on change when canChange is false", () => {
    const model = modelOf("sqlite", sqlite.authors);
    const denied = build(model, { mode: "change", canChange: false });
    expect(flat(denied).every((f) => !f.editable)).toBe(true);
    expect(editableFields(denied)).toEqual([]);
    const allowed = build(model, { mode: "change", canChange: true });
    expect(field(allowed, "name").editable).toBe(true);
  });

  it("keeps fields editable on add whatever canChange says", () => {
    const model = modelOf("sqlite", sqlite.authors);
    expect(field(build(model, { mode: "add", canChange: false }), "name").editable).toBe(true);
  });

  it("marks required only for notNull fields without a default on add", () => {
    const model = modelOf("sqlite", sqlite.authors);
    const add = build(model, { mode: "add" });
    expect(field(add, "name").required).toBe(true);
    expect(field(add, "email").required).toBe(false);
    expect(field(add, "active").required).toBe(false); // notNull with a default
    expect(field(build(model, { mode: "change" }), "active").required).toBe(true);
  });

  it("uses the key as the label", () => {
    const model = modelOf("sqlite", sqlite.authors);
    expect(field(build(model), "createdAt").label).toBe("createdAt");
  });
});

describe("buildFormGroups: default widgets", () => {
  const articlesAndAuthors = (): ResolvedModel =>
    modelOf("sqlite", sqlite.articles, undefined, [sqlite.authors]);
  const authorChoices: Choice[] = [
    { value: "1", label: "Ann" },
    { value: "2", label: "Bob" },
  ];

  it("uses a select with the FK choices for a registered FK", () => {
    const model = articlesAndAuthors();
    const f = field(
      build(model, { fkChoices: new Map([["authorId", authorChoices]]) }),
      "authorId",
    );
    expect(f.widget).toBe("select");
    expect(f.choices).toEqual(authorChoices); // notNull, so no empty choice
    expect(f.fkFallbackHref).toBeUndefined();
  });

  it("falls back to a number input and a link when the FK has too many choices", () => {
    const model = articlesAndAuthors();
    const f = field(build(model, { fkChoices: new Map([["authorId", "tooMany"]]) }), "authorId");
    expect(f.widget).toBe("number");
    expect(f.fkFallbackHref).toBe("/admin/authors/");
    expect(f.choices).toBeUndefined();
  });

  it("falls back to text for a non-numeric FK key", () => {
    const model = modelOf("sqlite", sqlite.articles, undefined, [sqlite.authors]);
    const meta = model.meta.fields.find((f) => f.key === "authorId");
    if (meta === undefined) throw new Error("no authorId");
    const textual = {
      ...model,
      meta: {
        ...model.meta,
        fields: model.meta.fields.map((f) => (f === meta ? { ...f, kind: "string" as const } : f)),
      },
    };
    const f = field(build(textual, { fkChoices: new Map([["authorId", "tooMany"]]) }), "authorId");
    expect(f.widget).toBe("text");
    expect(f.fkFallbackHref).toBe("/admin/authors/");
  });

  it("also falls back for a select override on an FK with too many choices", () => {
    const base = articlesAndAuthors();
    const model = { ...base, widgets: { authorId: "select" as const } };
    const f = field(build(model, { fkChoices: new Map([["authorId", "tooMany"]]) }), "authorId");
    expect(f.widget).toBe("number");
    expect(f.fkFallbackHref).toBe("/admin/authors/");
  });

  it("treats an FK to an unregistered table as a plain field", () => {
    const model = modelOf("sqlite", sqlite.articles); // authors not registered
    const f = field(build(model), "authorId");
    expect(f.widget).toBe("number");
    expect(f.fkFallbackHref).toBeUndefined();
  });

  it("uses a select with the enum values", () => {
    const model = modelOf("sqlite", sqlite.authors);
    const f = field(build(model), "role");
    expect(f.widget).toBe("select");
    expect(f.choices).toEqual([
      { value: "admin", label: "admin" },
      { value: "editor", label: "editor" },
      { value: "viewer", label: "viewer" },
    ]);
  });

  it("uses a checkbox, datetime, json and number for the matching kinds", () => {
    const authors = build(modelOf("sqlite", sqlite.authors));
    expect(field(authors, "active").widget).toBe("checkbox");
    expect(field(authors, "createdAt").widget).toBe("datetime");
    const articles = build(modelOf("sqlite", sqlite.articles));
    expect(field(articles, "meta").widget).toBe("json");
    expect(field(articles, "views").widget).toBe("number");
    expect(field(articles, "big").widget).toBe("number");
  });

  it("uses date for date-only Date and date-only string columns", () => {
    const events = build(modelOf("postgres", pg.events));
    expect(field(events, "day").meta.kind).toBe("date");
    expect(field(events, "day").widget).toBe("date");
    expect(field(events, "due").meta.kind).toBe("string");
    expect(field(events, "due").widget).toBe("date");
  });

  it("uses textarea for PG text and text for varchar", () => {
    const tags = build(modelOf("postgres", pg.tags));
    expect(field(tags, "description").widget).toBe("textarea");
    expect(field(tags, "label").widget).toBe("text");
  });

  it("uses text for short strings", () => {
    expect(field(build(modelOf("sqlite", sqlite.authors)), "name").widget).toBe("text");
  });
});

describe("buildFormGroups: widget overrides and the empty choice", () => {
  it("replaces the default widget with an explicit override", () => {
    const model = modelOf("sqlite", sqlite.authors, {
      widgets: { name: "textarea", role: "text", active: "checkbox" },
    });
    const groups = build(model);
    expect(field(groups, "name").widget).toBe("textarea");
    const role = field(groups, "role");
    expect(role.widget).toBe("text");
    expect(role.choices).toBeUndefined();
  });

  it.each([
    { name: "noView, default widget", choice: "noView", override: undefined, widget: "number" },
    { name: "noView, select override", choice: "noView", override: "select", widget: "number" },
    { name: "noView, hidden override", choice: "noView", override: "hidden", widget: "hidden" },
    { name: "noView, number override", choice: "noView", override: "number", widget: "number" },
    { name: "tooMany, hidden override", choice: "tooMany", override: "hidden", widget: "hidden" },
    { name: "tooMany, number override", choice: "tooMany", override: "number", widget: "number" },
  ] as const)(
    "gives an FK with $name no choices and no fallback link",
    ({ choice, override, widget }) => {
      const model = modelOf(
        "sqlite",
        sqlite.articles,
        override === undefined ? undefined : { widgets: { authorId: override } },
        [sqlite.authors],
      );
      const f = field(build(model, { fkChoices: new Map([["authorId", choice]]) }), "authorId");
      expect(f.widget).toBe(widget);
      expect(f.choices).toBeUndefined();
      expect(f.fkFallbackHref).toBeUndefined();
    },
  );

  it("falls back to a text input for a noView FK with a non-numeric key", () => {
    const model = modelOf("sqlite", sqlite.articles, undefined, [sqlite.authors]);
    const textual = {
      ...model,
      meta: {
        ...model.meta,
        fields: model.meta.fields.map((f) =>
          f.key === "authorId" ? { ...f, kind: "string" as const } : f,
        ),
      },
    };
    const f = field(build(textual, { fkChoices: new Map([["authorId", "noView"]]) }), "authorId");
    expect(f.widget).toBe("text");
    expect(f.fkFallbackHref).toBeUndefined();
  });

  it("adds the empty choice first only for nullable selects", () => {
    const events = field(build(modelOf("postgres", pg.events)), "mood");
    expect(events.meta.notNull).toBe(false);
    expect(events.choices).toEqual([
      { value: "", label: "---------" },
      { value: "calm", label: "calm" },
      { value: "busy", label: "busy" },
    ]);
    const role = field(build(modelOf("sqlite", sqlite.authors)), "role");
    expect(role.choices?.[0]).toEqual({ value: "admin", label: "admin" });
  });

  it("adds the empty choice to a nullable FK select", () => {
    // The fixture's `authorId` is notNull, so make a nullable copy of it.
    const model = modelOf("sqlite", sqlite.articles, undefined, [sqlite.authors]);
    const nullable = {
      ...model,
      meta: {
        ...model.meta,
        fields: model.meta.fields.map((f) => (f.key === "authorId" ? { ...f, notNull: false } : f)),
      },
    };
    const f = field(
      build(nullable, { fkChoices: new Map([["authorId", [{ value: "1", label: "Ann" }]]]) }),
      "authorId",
    );
    expect(f.choices).toEqual([
      { value: "", label: "---------" },
      { value: "1", label: "Ann" },
    ]);
  });
});

describe("buildFormGroups: fieldsets", () => {
  it("groups by fieldset with titles and drops empty groups", () => {
    const model = modelOf("sqlite", sqlite.authors, {
      fieldsets: [
        { title: "Identity", fields: ["name", "email"] },
        { fields: ["role", "active"] },
        { title: "Meta", fields: ["id"] }, // auto PK: empty on add
      ],
    });
    const add = build(model, { mode: "add" });
    expect(add).toHaveLength(2);
    expect(add[0]?.title).toBe("Identity");
    expect(add[1]).not.toHaveProperty("title");
    expect(add.map((g) => g.fields.map((f) => f.key))).toEqual([
      ["name", "email"],
      ["role", "active"],
    ]);
    const change = build(model, { mode: "change" });
    expect(change).toHaveLength(3);
    expect(change[2]?.title).toBe("Meta");
  });

  it("applies exclude and the default single group in definition order", () => {
    const model = modelOf("sqlite", sqlite.authors, { exclude: ["email", "createdAt"] });
    const groups = build(model);
    expect(groups).toHaveLength(1);
    expect(groups[0]).not.toHaveProperty("title");
    expect(keys(groups)).toEqual(["name", "active", "role"]);
  });

  it("returns only editable fields, in order, from editableFields", () => {
    const model = modelOf("sqlite", sqlite.authors, {
      readonlyFields: ["email"],
      fieldsets: [
        { title: "A", fields: ["name", "email"] },
        { title: "B", fields: ["id", "role"] },
      ],
    });
    const groups = build(model, { mode: "change" });
    expect(keys(groups)).toEqual(["name", "email", "id", "role"]);
    expect(editableFields(groups).map((f) => f.key)).toEqual(["name", "role"]);
  });
});
