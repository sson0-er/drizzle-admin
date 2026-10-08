import { type Column, eq, getTableColumns, sql, type Table } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdmin, type ModelAdminOptions } from "../src/index.js";
import { MESSAGES } from "../src/messages.js";
import {
  type Client,
  createClient,
  makeAdmin,
  TEST_SECRET,
  TEST_USER,
  type TestAdmin,
} from "./helpers/app.js";
import { type DialectFixture, dialects } from "./helpers/db.js";
import { attr, type Element, type Node, parse, qs, qsa, text } from "./helpers/html.js";

const messages = MESSAGES.en;

type Rec = Record<string, unknown>;
type RawDb = {
  select(): { from(table: Table): PromiseLike<Rec[]> };
  insert(table: Table): { values(rows: Rec | Rec[]): { returning(): PromiseLike<Rec[]> } };
  delete(table: Table): { where(cond: unknown): PromiseLike<unknown> };
  execute?(query: unknown): PromiseLike<{ rows: Rec[] }>;
};
const raw = (t: TestAdmin) => t.db as RawDb;
type Models = Record<string, ModelAdminOptions<Table>>;
type TableName = "authors" | "articles" | "kv" | "events";

const tableOf = (t: TestAdmin, name: TableName): Table => {
  const table = t.schema[name];
  if (table === undefined) throw new Error(`no table ${name}`);
  return table;
};
const rowsOf = (t: TestAdmin, name: TableName) => raw(t).select().from(tableOf(t, name));
async function rowWhere(t: TestAdmin, name: TableName, key: string, value: unknown): Promise<Rec> {
  const row = (await rowsOf(t, name)).find((r) => r[key] === value);
  if (row === undefined) throw new Error(`no ${name} row with ${key}=${String(value)}`);
  return row;
}
async function insertRow(t: TestAdmin, name: TableName, values: Rec): Promise<Rec> {
  const [row] = await raw(t).insert(tableOf(t, name)).values(values).returning();
  if (row === undefined) throw new Error("insert returned no row");
  return row;
}

/** Another admin over the same database, so one PGlite instance serves many configurations. */
async function adminOn(
  t: TestAdmin,
  fixture: DialectFixture,
  models: Models,
  config: { timeZone?: string } = {},
): Promise<Client> {
  const admin = createAdmin({
    db: t.db,
    dialect: fixture.dialect,
    basePath: "/admin",
    secret: TEST_SECRET,
    timeZone: "Asia/Tokyo",
    auth: { verifyCredentials: async () => TEST_USER },
    ...config,
  });
  for (const [name, options] of Object.entries(models)) {
    admin.register(tableOf(t, name as TableName), options);
  }
  const client = createClient((req) => admin.fetch(req));
  await client.login();
  return client;
}

async function send(client: Client, path: string, form: Record<string, string | string[]> = {}) {
  // The first POST needs a session, which any GET issues.
  if (client.cookie("da_session") === undefined) await client.get("/admin/");
  return client.post(path, form);
}

/** A change submission as a browser sends it: the page's own form values with some overridden. */
async function change(client: Client, path: string, overrides: Record<string, string>) {
  const form = formOf(await docOf(await client.get(path)));
  return send(client, path, { ...form, ...overrides });
}

async function docOf(res: Response): Promise<Node> {
  return parse(await res.text());
}

/** The success page after a 303: the flash shows once. */
async function flashTexts(client: Client, res: Response): Promise<string[]> {
  const doc = await docOf(await client.get(res.headers.get("Location") ?? ""));
  const list = qs(doc, { tag: "ul", cls: "messagelist" });
  return list === null ? [] : qsa(list, { tag: "li" }).map((li) => text(li).trim());
}

const rowOf = (doc: Node, key: string): Node => {
  const row = qs(doc, { tag: "div", cls: "form-row", attrs: { "data-field": key } });
  if (row === null) throw new Error(`no form row ${key}`);
  return row;
};
const hasRow = (doc: Node, key: string): boolean =>
  qs(doc, { tag: "div", cls: "form-row", attrs: { "data-field": key } }) !== null;

function errorsOf(doc: Node, key: string): string {
  const list = qs(rowOf(doc, key), { tag: "ul", cls: "errorlist" });
  return list === null ? "" : text(list);
}

function controlOf(doc: Node, key: string): { type: string | null; value: string } | null {
  const row = rowOf(doc, key);
  const input = qs(row, { tag: "input" });
  if (input !== null) return { type: attr(input, "type"), value: attr(input, "value") ?? "" };
  const area = qs(row, { tag: "textarea" });
  if (area !== null) return { type: "textarea", value: text(area) };
  const select = qs(row, { tag: "select" });
  if (select === null) return null;
  const options = qsa(select, { tag: "option" });
  const chosen = options.find((o) => attr(o, "selected") !== null) ?? options[0];
  return { type: "select", value: chosen === undefined ? "" : (attr(chosen, "value") ?? "") };
}
const inputValue = (doc: Node, key: string): string | undefined => controlOf(doc, key)?.value;

/** What a browser would submit from the page's form (editable controls only). */
function formOf(doc: Node): Record<string, string> {
  const form = qs(doc, { tag: "form", id: "model-form" });
  if (form === null) throw new Error("no form#model-form");
  const out: Record<string, string> = {};
  for (const el of qsa(form, { tag: "input" })) {
    const name = attr(el, "name");
    if (name === null || name === "_csrf") continue;
    if (attr(el, "type") === "checkbox") {
      if (attr(el, "checked") !== null) out[name] = "on";
    } else out[name] = attr(el, "value") ?? "";
  }
  for (const el of qsa(form, { tag: "textarea" })) {
    const name = attr(el, "name");
    if (name !== null) out[name] = text(el);
  }
  for (const el of qsa(form, { tag: "select" })) {
    const name = attr(el, "name");
    if (name === null) continue;
    const options = qsa(el, { tag: "option" });
    const chosen = options.find((o) => attr(o, "selected") !== null) ?? options[0];
    out[name] = chosen === undefined ? "" : (attr(chosen, "value") ?? "");
  }
  return out;
}

const hasButton = (doc: Node, name: string) => qs(doc, { tag: "button", attrs: { name } }) !== null;

describe.each(dialects)("add and change forms ($name)", (fixture) => {
  let t: TestAdmin;
  let client: Client;
  const models: Models = {
    authors: { toString: (row) => String(row.name) },
    articles: { toString: (row) => String(row.title) },
    kv: { toString: (row) => String(row.key) },
  };
  const ctxOf = (mode: "add" | "change") => ({
    mode,
    user: { id: expect.any(String), name: expect.any(String) },
    db: expect.anything(),
  });

  beforeAll(async () => {
    t = await makeAdmin(fixture, { config: { timeZone: "Asia/Tokyo" } });
    client = await adminOn(t, fixture, models);
  });
  afterAll(async () => {
    await t.close();
  });

  describe("pages", () => {
    it("renders the add page for every model", async () => {
      for (const slug of ["authors", "articles", "kv"]) {
        const res = await client.get(`/admin/${slug}/add/`);
        expect(res.status, slug).toBe(200);
        const doc = await docOf(res);
        expect(qs(doc, { tag: "form", id: "model-form" }), slug).not.toBeNull();
        for (const name of ["_save", "_addanother", "_continue"]) {
          expect(hasButton(doc, name), `${slug} ${name}`).toBe(true);
        }
      }
    });

    // Runs before the tests that add authors, so the four seeded authors are all there is.
    it.each([
      { name: "no ordering (primary key descending)", options: {}, ids: ["4", "3", "2", "1"] },
      { name: 'ordering ["id"]', options: { ordering: ["id"] }, ids: ["1", "2", "3", "4"] },
    ])("orders the FK select by the referenced model's default: $name", async (c) => {
      const own = await adminOn(t, fixture, { authors: c.options, articles: {} });
      const doc = await docOf(await own.get("/admin/articles/add/"));
      const select = qs(rowOf(doc, "authorId"), { tag: "select" });
      expect(select).not.toBeNull();
      const values = qsa(select as Element, { tag: "option" }).map((o) => attr(o, "value"));
      expect(values).toEqual(c.ids);
    });

    it("renders the change page for every model", async () => {
      for (const path of ["authors/1", "articles/1", "kv/a"]) {
        const res = await client.get(`/admin/${path}/change/`);
        expect(res.status, path).toBe(200);
        const doc = await docOf(res);
        expect(hasButton(doc, "_save"), path).toBe(true);
        expect(qs(doc, { tag: "a", cls: "deletelink" }), path).not.toBeNull();
      }
    });

    it("answers 404 for an unknown model or primary key", async () => {
      for (const path of [
        "nope/add/",
        "nope/1/change/",
        "authors/9999/change/",
        "kv/zzz/change/",
      ]) {
        expect((await client.get(`/admin/${path}`)).status, path).toBe(404);
      }
      const res = await send(client, "/admin/authors/9999/change/", { name: "x" });
      expect(res.status).toBe(404);
      expect((await send(client, "/admin/nope/add/", {})).status).toBe(404);
    });

    it("fills the change form from the stored row and offers FK choices", async () => {
      const doc = await docOf(await client.get("/admin/articles/1/change/"));
      expect(inputValue(doc, "title")).toBe("Alpha");
      expect(inputValue(doc, "authorId")).toBe("1");
      expect(inputValue(doc, "views")).toBe("10");
      expect(inputValue(doc, "big")).toBe("10");
      expect(controlOf(doc, "authorId")?.type).toBe("select");
      expect(hasRow(doc, "id")).toBe(true);
      expect(controlOf(doc, "id")).toBeNull();
    });
  });

  describe("happy path", () => {
    it("adds an author with text, boolean, enum and timestamp columns", async () => {
      const res = await send(client, "/admin/authors/add/", {
        name: "ann",
        email: "ann@example.com",
        active: "on",
        role: "editor",
        createdAt: "2026-10-07T09:30",
        _save: "1",
      });
      expect(res.status).toBe(303);
      expect(await flashTexts(client, res)).toEqual([messages.added("ann")]);
      const row = await rowWhere(t, "authors", "name", "ann");
      expect(row).toMatchObject({ email: "ann@example.com", active: true, role: "editor" });
      // 09:30 in Asia/Tokyo is 00:30 UTC.
      expect((row.createdAt as Date).toISOString()).toBe("2026-10-07T00:30:00.000Z");
    });

    it("shows the flash only once", async () => {
      const res = await send(client, "/admin/authors/add/", { name: "once" });
      const location = res.headers.get("Location") ?? "";
      expect(
        qs(await docOf(await client.get(location)), { tag: "ul", cls: "messagelist" }),
      ).not.toBeNull();
      expect(
        qs(await docOf(await client.get(location)), { tag: "ul", cls: "messagelist" }),
      ).toBeNull();
    });

    it("shows a check icon on the success flash after an add", async () => {
      const res = await send(client, "/admin/authors/add/", { name: "flash-icon" });
      const doc = await docOf(await client.get(res.headers.get("Location") ?? ""));
      const li = qs(doc, { tag: "li", cls: "success" }) as Node;
      expect(qsa(li, { tag: "svg", attrs: { "data-icon": "check" } })).toHaveLength(1);
    });

    it("applies column defaults and stores null for empty nullable fields", async () => {
      const res = await send(client, "/admin/authors/add/", { name: "dflt", email: "" });
      expect(res.status).toBe(303);
      const row = await rowWhere(t, "authors", "name", "dflt");
      expect(row).toMatchObject({ email: null, active: false, role: "viewer" });
      expect(row.createdAt).toBeInstanceOf(Date);
    });

    it("adds an article with FK, long text, timestamp, json, integer, real and bigint", async () => {
      const res = await send(client, "/admin/articles/add/", {
        title: "typed",
        body: "line1\nline2",
        authorId: "2",
        publishedAt: "2026-10-07T09:30",
        meta: '{"a":[1,2]}',
        views: "7",
        score: "1.5",
        big: "9007199254740993",
      });
      expect(res.status).toBe(303);
      expect(await flashTexts(client, res)).toEqual([messages.added("typed")]);
      const row = await rowWhere(t, "articles", "title", "typed");
      expect(row).toMatchObject({
        body: "line1\nline2",
        authorId: 2,
        meta: { a: [1, 2] },
        views: 7,
        score: 1.5,
        big: 9007199254740993n,
      });
      expect((row.publishedAt as Date).toISOString()).toBe("2026-10-07T00:30:00.000Z");
    });

    it("stores null for empty nullable articles columns", async () => {
      await send(client, "/admin/articles/add/", {
        title: "sparse",
        authorId: "1",
        body: "",
        publishedAt: "",
        meta: "",
        views: "",
        score: "",
        big: "",
      });
      expect(await rowWhere(t, "articles", "title", "sparse")).toMatchObject({
        body: null,
        publishedAt: null,
        meta: null,
        views: null,
        score: null,
        big: null,
      });
    });

    it("adds a row with a text primary key", async () => {
      const res = await send(client, "/admin/kv/add/", { key: "k1", value: "v1" });
      expect(res.status).toBe(303);
      expect(await flashTexts(client, res)).toEqual([messages.added("k1")]);
      expect(await rowWhere(t, "kv", "key", "k1")).toEqual({ key: "k1", value: "v1" });
    });

    it("changes every column type of an article and keeps the redirect flash", async () => {
      const seeded = await insertRow(t, "articles", { title: "chg", authorId: 1, views: 1 });
      const path = `/admin/articles/${String(seeded.id)}/change/`;
      const res = await send(client, path, {
        title: "chg2",
        body: "b",
        authorId: "3",
        publishedAt: "2026-01-02T03:04",
        meta: "[1]",
        views: "",
        score: "2.25",
        big: "-5",
      });
      expect(res.status).toBe(303);
      expect(await flashTexts(client, res)).toEqual([messages.changed("chg2")]);
      const row = await rowWhere(t, "articles", "id", seeded.id);
      expect(row).toMatchObject({
        title: "chg2",
        body: "b",
        authorId: 3,
        meta: [1],
        views: null,
        score: 2.25,
        big: -5n,
      });
      // 03:04 in Asia/Tokyo is 18:04 UTC of the previous day.
      expect((row.publishedAt as Date).toISOString()).toBe("2026-01-01T18:04:00.000Z");
    });

    it("round-trips a change page unchanged", async () => {
      const seeded = await insertRow(t, "articles", {
        title: "round",
        authorId: 1,
        publishedAt: new Date("2026-10-07T00:30:00Z"),
        meta: { k: "v" },
        views: 3,
        score: 0.5,
        big: 12n,
      });
      const path = `/admin/articles/${String(seeded.id)}/change/`;
      const form = formOf(await docOf(await client.get(path)));
      expect((await send(client, path, form)).status).toBe(303);
      expect(await rowWhere(t, "articles", "id", seeded.id)).toEqual(seeded);
    });

    it("changes a boolean and an enum, and unchecking stores false", async () => {
      const seeded = await insertRow(t, "authors", { name: "flip", active: true, role: "admin" });
      const path = `/admin/authors/${String(seeded.id)}/change/`;
      const form = formOf(await docOf(await client.get(path)));
      expect(form.active).toBe("on");
      delete form.active;
      await send(client, path, { ...form, role: "viewer" });
      expect(await rowWhere(t, "authors", "id", seeded.id)).toMatchObject({
        active: false,
        role: "viewer",
      });
    });

    it("changes a row with a text primary key without renaming it", async () => {
      await insertRow(t, "kv", { key: "chgkey", value: "old" });
      const res = await send(client, "/admin/kv/chgkey/change/", { key: "renamed", value: "new" });
      expect(res.status).toBe(303);
      expect(await rowWhere(t, "kv", "key", "chgkey")).toEqual({ key: "chgkey", value: "new" });
      expect((await rowsOf(t, "kv")).some((r) => r.key === "renamed")).toBe(false);
    });
  });

  describe("validation", () => {
    const cases: {
      name: string;
      path: string;
      form: Record<string, string>;
      field: string;
      message: string;
    }[] = [
      {
        name: "invalid integer text",
        path: "articles",
        form: { views: "abc" },
        field: "views",
        message: messages.invalidNumber,
      },
      {
        name: "fractional integer",
        path: "articles",
        form: { views: "1.5" },
        field: "views",
        message: messages.invalidInteger,
      },
      {
        name: "hexadecimal integer",
        path: "articles",
        form: { views: "0x1F" },
        field: "views",
        message: messages.invalidInteger,
      },
      {
        name: "invalid real",
        path: "articles",
        form: { score: "x" },
        field: "score",
        message: messages.invalidNumber,
      },
      {
        name: "invalid bigint",
        path: "articles",
        form: { big: "1.5" },
        field: "big",
        message: messages.invalidInteger,
      },
      {
        name: "invalid timestamp",
        path: "articles",
        form: { publishedAt: "garbage" },
        field: "publishedAt",
        message: messages.invalidDate,
      },
      {
        name: "invalid json",
        path: "articles",
        form: { meta: "{bad" },
        field: "meta",
        message: messages.invalidJson,
      },
      {
        name: "invalid FK",
        path: "articles",
        form: { authorId: "abc" },
        field: "authorId",
        message: messages.invalidNumber,
      },
      {
        name: "invalid enum",
        path: "authors",
        form: { name: "enumbad", role: "nope" },
        field: "role",
        message: messages.invalidChoice,
      },
      {
        name: "missing required",
        path: "authors",
        form: { name: "" },
        field: "name",
        message: messages.required,
      },
    ];

    it.each(cases)("add: $name -> 400 with the raw values kept", async (c) => {
      const base: Record<string, string> =
        c.path === "articles" ? { title: "kept title", authorId: "1" } : {};
      const form = { ...base, ...c.form };
      const res = await send(client, `/admin/${c.path}/add/`, form);
      expect(res.status).toBe(400);
      const doc = await docOf(res);
      expect(errorsOf(doc, c.field)).toContain(c.message);
      expect(qs(doc, { tag: "p", cls: "errornote" })).not.toBeNull();
      for (const [key, value] of Object.entries(form)) {
        if (controlOf(doc, key)?.type !== "select") expect(inputValue(doc, key), key).toBe(value);
      }
      expect(await rowsOf(t, c.path === "articles" ? "articles" : "authors")).not.toContainEqual(
        expect.objectContaining({ title: "kept title" }),
      );
    });

    it("add: views=3000000000 is rejected on PG (int4) and stored on SQLite", async () => {
      const res = await send(client, "/admin/articles/add/", {
        title: "int4-overflow",
        authorId: "1",
        views: "3000000000",
      });
      expect(res.status).toBe(fixture.name === "pglite" ? 400 : 303);
      if (fixture.name === "pglite") {
        expect(errorsOf(await docOf(res), "views")).toContain(messages.invalidInteger);
      }
    });

    it("change: a coercion error -> 400 with the raw values kept", async () => {
      const seeded = await insertRow(t, "articles", { title: "bad-change", authorId: 1, views: 5 });
      const path = `/admin/articles/${String(seeded.id)}/change/`;
      const res = await send(client, path, { title: "edited", authorId: "1", views: "nope" });
      expect(res.status).toBe(400);
      const doc = await docOf(res);
      expect(errorsOf(doc, "views")).toContain(messages.invalidNumber);
      expect(inputValue(doc, "views")).toBe("nope");
      expect(inputValue(doc, "title")).toBe("edited");
      // The stored row is shown for display-only fields and is not modified.
      expect(text(rowOf(doc, "id"))).toContain(String(seeded.id));
      expect(await rowWhere(t, "articles", "id", seeded.id)).toMatchObject({
        title: "bad-change",
        views: 5,
      });
    });

    it("reports a unique violation as a form error", async () => {
      const res = await send(client, "/admin/authors/add/", { name: "alice" });
      expect(res.status).toBe(400);
      const doc = await docOf(res);
      expect(qs(doc, { tag: "p", cls: "errornote" })).not.toBeNull();
      expect(text(doc)).toContain(messages.dbUnique);
      expect(inputValue(doc, "name")).toBe("alice");
    });

    it("reports a unique violation on change", async () => {
      const seeded = await insertRow(t, "authors", { name: "uniq-change" });
      const res = await change(client, `/admin/authors/${String(seeded.id)}/change/`, {
        name: "alice",
        active: "on",
        role: "viewer",
      });
      expect(res.status).toBe(400);
      expect(text(await docOf(res))).toContain(messages.dbUnique);
    });

    it("reports a foreign key violation", async () => {
      const res = await send(client, "/admin/articles/add/", {
        title: "orphan",
        authorId: "99999",
      });
      expect(res.status).toBe(400);
      expect(text(await docOf(res))).toContain(messages.dbForeignKey);
    });

    it("reports a not-null violation raised by the database", async () => {
      const c = await adminOn(t, fixture, {
        articles: { hooks: { beforeSave: (data) => ({ ...data, title: null }) } },
      });
      const res = await send(c, "/admin/articles/add/", { title: "x", authorId: "1" });
      expect(res.status).toBe(400);
      expect(text(await docOf(res))).toContain(messages.dbNotNull);
    });

    it("shows `validate` errors on a field and on the form", async () => {
      const c = await adminOn(t, fixture, {
        authors: {
          validate: (data) => ({ name: `bad ${String(data.name)}`, _form: "form-level problem" }),
        },
      });
      const res = await send(c, "/admin/authors/add/", { name: "vfail" });
      expect(res.status).toBe(400);
      const doc = await docOf(res);
      expect(errorsOf(doc, "name")).toContain("bad vfail");
      const nonfield = qs(doc, { tag: "ul", cls: "errorlist nonfield" });
      expect(nonfield === null ? "" : text(nonfield)).toContain("form-level problem");
      expect(inputValue(doc, "name")).toBe("vfail");
      expect((await rowsOf(t, "authors")).some((r) => r.name === "vfail")).toBe(false);
    });

    it("ignores `id` and unknown keys in the body", async () => {
      const res = await send(client, "/admin/authors/add/", {
        name: "mass",
        id: "777",
        bogus: "x",
        createdAt: "",
      });
      expect(res.status).toBe(303);
      expect((await rowWhere(t, "authors", "name", "mass")).id).not.toBe(777);

      const seeded = await insertRow(t, "authors", { name: "mass2" });
      const res2 = await change(client, `/admin/authors/${String(seeded.id)}/change/`, {
        name: "mass2b",
        active: "on",
        role: "viewer",
        id: "888",
        bogus: "x",
      });
      expect(res2.status).toBe(303);
      expect(await rowWhere(t, "authors", "id", seeded.id)).toMatchObject({ name: "mass2b" });
      expect((await rowsOf(t, "authors")).some((r) => r.id === 888)).toBe(false);
    });

    it("does not write readonly fields and omits the auto PK on add", async () => {
      const c = await adminOn(t, fixture, { authors: { readonlyFields: ["email"] } });
      const add = await c.get("/admin/authors/add/");
      const addDoc = await docOf(add);
      expect(hasRow(addDoc, "email")).toBe(false);
      expect(hasRow(addDoc, "id")).toBe(false);
      await send(c, "/admin/authors/add/", { name: "ro-add", email: "evil@example.com" });
      expect(await rowWhere(t, "authors", "name", "ro-add")).toMatchObject({ email: null });

      const seeded = await insertRow(t, "authors", { name: "ro-chg", email: "keep@example.com" });
      const path = `/admin/authors/${String(seeded.id)}/change/`;
      const changeDoc = await docOf(await c.get(path));
      // Both are shown as plain text, never as inputs.
      expect(controlOf(changeDoc, "email")).toBeNull();
      expect(controlOf(changeDoc, "id")).toBeNull();
      await change(c, path, {
        name: "ro-chg",
        active: "on",
        role: "viewer",
        email: "evil@example.com",
        id: "5",
      });
      expect(await rowWhere(t, "authors", "id", seeded.id)).toMatchObject({
        email: "keep@example.com",
      });
    });
  });

  describe("hooks", () => {
    it("passes data and { mode, user, db } to beforeSave and lets it modify the data", async () => {
      const calls: { data: Rec; ctx: Rec }[] = [];
      const c = await adminOn(t, fixture, {
        authors: {
          hooks: {
            beforeSave: (data, ctx) => {
              calls.push({ data: { ...data }, ctx: { ...ctx } });
              return { ...data, name: String(data.name).toUpperCase() };
            },
          },
        },
      });
      await send(c, "/admin/authors/add/", { name: "hooked", role: "admin" });
      const row = await rowWhere(t, "authors", "name", "HOOKED");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.data).toMatchObject({ name: "hooked", role: "admin" });
      expect(calls[0]?.ctx).toEqual(ctxOf("add"));
      expect(calls[0]?.ctx.db).toBe(t.db);

      await change(c, `/admin/authors/${String(row.id)}/change/`, {
        name: "again",
        active: "on",
        role: "viewer",
      });
      expect(calls).toHaveLength(2);
      expect(calls[1]?.ctx).toEqual(ctxOf("change"));
      expect(calls[1]?.ctx.db).toBe(t.db);
      expect(await rowWhere(t, "authors", "id", row.id)).toMatchObject({ name: "AGAIN" });
    });

    it("passes the saved row to afterSave", async () => {
      const calls: { row: Rec; ctx: Rec }[] = [];
      const c = await adminOn(t, fixture, {
        authors: { hooks: { afterSave: (row, ctx) => void calls.push({ row, ctx: { ...ctx } }) } },
      });
      await send(c, "/admin/authors/add/", { name: "after1" });
      const saved = await rowWhere(t, "authors", "name", "after1");
      expect(calls[0]?.row).toEqual(saved);
      expect(calls[0]?.ctx).toEqual(ctxOf("add"));
      await change(c, `/admin/authors/${String(saved.id)}/change/`, {
        name: "after2",
        active: "on",
        role: "viewer",
      });
      expect(calls[1]?.row).toMatchObject({ id: saved.id, name: "after2" });
      expect(calls[1]?.ctx).toEqual(ctxOf("change"));
      expect(calls[1]?.ctx.db).toBe(t.db);
    });

    it("turns a throwing beforeSave into a 400 and writes nothing", async () => {
      const c = await adminOn(t, fixture, {
        authors: {
          hooks: {
            beforeSave: () => {
              throw new Error("secret detail");
            },
          },
        },
      });
      const res = await send(c, "/admin/authors/add/", { name: "nohook" });
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(text(parse(body))).toContain(messages.hookFailed);
      expect(body).not.toContain("secret detail");
      expect((await rowsOf(t, "authors")).some((r) => r.name === "nohook")).toBe(false);
    });

    it("keeps the success when afterSave throws and adds a warning flash", async () => {
      const c = await adminOn(t, fixture, {
        authors: {
          toString: (row) => String(row.name),
          hooks: {
            afterSave: () => {
              throw new Error("boom");
            },
          },
        },
      });
      const res = await send(c, "/admin/authors/add/", { name: "afterboom" });
      expect(res.status).toBe(303);
      expect(await flashTexts(c, res)).toEqual([
        messages.added("afterboom"),
        messages.afterSaveFailed,
      ]);
      expect(await rowWhere(t, "authors", "name", "afterboom")).toBeDefined();
    });

    it("answers 404 when the row disappears before the update", async () => {
      await insertRow(t, "kv", { key: "gone", value: "x" });
      const c = await adminOn(t, fixture, {
        kv: {
          hooks: {
            beforeSave: async (data, ctx) => {
              const kv = tableOf(t, "kv");
              await (ctx.db as RawDb)
                .delete(kv)
                .where(eq(getTableColumns(kv).key as Column, "gone"));
              return data;
            },
          },
        },
      });
      const res = await send(c, "/admin/kv/gone/change/", { value: "y" });
      expect(res.status).toBe(404);
    });
  });

  describe("buttons", () => {
    it("add redirects by button", async () => {
      const save = await send(client, "/admin/authors/add/", { name: "btn1", _save: "1" });
      expect(save.headers.get("Location")).toBe("/admin/authors/");
      const another = await send(client, "/admin/authors/add/", { name: "btn2", _addanother: "1" });
      expect(another.headers.get("Location")).toBe("/admin/authors/add/");
      const cont = await send(client, "/admin/authors/add/", { name: "btn3", _continue: "1" });
      const id = (await rowWhere(t, "authors", "name", "btn3")).id;
      expect(cont.headers.get("Location")).toBe(`/admin/authors/${String(id)}/change/`);
      for (const res of [save, another, cont]) expect(res.status).toBe(303);
    });

    it("add continue encodes a text primary key", async () => {
      const res = await send(client, "/admin/kv/add/", {
        key: "a b/c",
        value: "v",
        _continue: "1",
      });
      expect(res.headers.get("Location")).toBe("/admin/kv/a%20b%2Fc/change/");
    });

    it("change redirects by button", async () => {
      const seeded = await insertRow(t, "authors", { name: "btn-chg" });
      const path = `/admin/authors/${String(seeded.id)}/change/`;
      const cont = await change(client, path, { _continue: "1" });
      expect(cont.headers.get("Location")).toBe(path);
      const another = await change(client, path, { _addanother: "1" });
      expect(another.headers.get("Location")).toBe("/admin/authors/add/");
      const save = await change(client, path, { _save: "1" });
      expect(save.headers.get("Location")).toBe("/admin/authors/");
    });
  });

  describe("permissions", () => {
    it("forbids add without the add permission", async () => {
      const c = await adminOn(t, fixture, { authors: { permissions: { add: false } } });
      expect((await c.get("/admin/authors/add/")).status).toBe(403);
      expect((await send(c, "/admin/authors/add/", { name: "denied" })).status).toBe(403);
      expect((await rowsOf(t, "authors")).some((r) => r.name === "denied")).toBe(false);
    });

    it("shows a read-only change page with view only, and forbids the POST", async () => {
      const c = await adminOn(t, fixture, {
        authors: { permissions: { change: false, delete: false } },
      });
      const res = await c.get("/admin/authors/1/change/");
      expect(res.status).toBe(200);
      const doc = await docOf(res);
      for (const name of ["_save", "_addanother", "_continue"])
        expect(hasButton(doc, name)).toBe(false);
      expect(qs(doc, { tag: "a", cls: "deletelink" })).toBeNull();
      expect(controlOf(doc, "name")).toBeNull();
      expect((await send(c, "/admin/authors/1/change/", { name: "alice" })).status).toBe(403);
    });

    it("renders a boolean mark for a read-only boolean field of an active author", async () => {
      const c = await adminOn(t, fixture, { authors: { permissions: { change: false } } });
      const doc = await docOf(await c.get("/admin/authors/1/change/"));
      const row = rowOf(doc, "active");
      expect(qsa(row, { tag: "span", cls: "boolean-mark" })).toHaveLength(1);
      expect(qsa(row, { tag: "svg", attrs: { "data-icon": "check" } })).toHaveLength(1);
      expect(text(row)).toContain(messages.yes);
      expect(text(row)).not.toContain("✓");
    });

    it("answers 404 on the change page for a model without any permission", async () => {
      const c = await adminOn(t, fixture, { authors: { permissions: { view: false } } });
      expect((await c.get("/admin/authors/1/change/")).status).toBe(404);
    });
  });

  // Last of the authors tests: it fills the table beyond the choice limit.
  it("falls back to a plain input with a link when an FK has more than 200 choices", async () => {
    const authors = tableOf(t, "authors");
    const insert = raw(t).insert(authors) as unknown as {
      values(rows: Rec[]): PromiseLike<unknown>;
    };
    await insert.values(Array.from({ length: 201 }, (_, i) => ({ name: `bulk-${i}` })));
    for (const path of ["add/", "1/change/"]) {
      const res = await client.get(`/admin/articles/${path}`);
      expect(res.status, path).toBe(200);
      const doc = await docOf(res);
      expect(controlOf(doc, "authorId")?.type, path).toBe("number");
      const link = qs(rowOf(doc, "authorId"), { tag: "a" });
      expect(link === null ? null : attr(link, "href"), path).toBe("/admin/authors/");
    }
  });

  // The FK select offers at most 200 choices; past that the form falls back to a PK input. A
  // database of its own keeps the author count independent of the tests above.
  describe("FK fallback", () => {
    let own: TestAdmin;
    const fillAuthors = async (target: number): Promise<void> => {
      const have = (await rowsOf(own, "authors")).length;
      const rows = Array.from({ length: target - have }, (_, i) => ({ name: `fill-${have + i}` }));
      if (rows.length > 0) await raw(own).insert(tableOf(own, "authors")).values(rows).returning();
      expect(await rowsOf(own, "authors")).toHaveLength(target);
    };

    beforeAll(async () => {
      own = await makeAdmin(fixture, {
        models: { authors: models.authors ?? null, articles: models.articles ?? null },
      });
    });
    afterAll(async () => {
      await own.close();
    });

    it("keeps the select at 200 authors and falls back to a PK input at 201", async () => {
      await fillAuthors(200);
      const select = await docOf(await own.client.get("/admin/articles/add/"));
      const selectRow = rowOf(select, "authorId");
      expect(qs(selectRow, { tag: "select", attrs: { name: "authorId" } })).not.toBeNull();
      expect(qs(selectRow, { tag: "a" })).toBeNull();

      await fillAuthors(201);
      const doc = await docOf(await own.client.get("/admin/articles/add/"));
      const row = rowOf(doc, "authorId");
      expect(qs(row, { tag: "select" })).toBeNull();
      expect(qs(row, { tag: "input", attrs: { type: "number", name: "authorId" } })).not.toBeNull();
      const link = qs(row, { tag: "a", attrs: { href: "/admin/authors/" } });
      expect(link).not.toBeNull();
      expect(link && text(link)).toBe(messages.openRelated);
    });

    it("creates the row from an author id typed into the fallback input", async () => {
      await fillAuthors(201);
      const res = await send(own.client, "/admin/articles/add/", {
        title: "fk-typed",
        authorId: "2",
      });
      expect(res.status).toBe(303);
      expect(await rowWhere(own, "articles", "title", "fk-typed")).toMatchObject({ authorId: 2 });
    });
  });

  // Date-only columns exist on PG only (decisions 019, 023). One more admin per time zone over the
  // same database keeps the number of PGlite instances down.
  if (fixture.name === "pglite") {
    describe.each(["Asia/Tokyo", "America/New_York"])(
      "date-only columns on events (%s)",
      (timeZone) => {
        let client: Client;
        const textOf = async (column: "day" | "due", note: string): Promise<string | undefined> => {
          const result = await raw(t).execute?.(
            sql`select ${sql.raw(`${column}::text`)} as v from events where note = ${note}`,
          );
          return result?.rows[0]?.v as string | undefined;
        };
        const idOf = async (note: string) => String((await rowWhere(t, "events", "note", note)).id);

        beforeAll(async () => {
          client = await adminOn(t, fixture, { events: {} }, { timeZone });
        });

        it("stores the calendar day of a date column unshifted", async () => {
          const note = `day-${timeZone}`;
          const add = await docOf(await client.get("/admin/events/add/"));
          expect(controlOf(add, "day")?.type).toBe("date");
          const res = await send(client, "/admin/events/add/", { day: "2026-10-07", note });
          expect(res.status).toBe(303);
          expect(await textOf("day", note)).toBe("2026-10-07");

          const path = `/admin/events/${await idOf(note)}/change/`;
          const doc = await docOf(await client.get(path));
          expect(inputValue(doc, "day")).toBe("2026-10-07");
          const kept = await send(client, path, { ...formOf(doc), note });
          expect(kept.status).toBe(303);
          expect(await textOf("day", note)).toBe("2026-10-07");
        });

        it("stores a date-only string as written", async () => {
          const note = `due-${timeZone}`;
          const add = await docOf(await client.get("/admin/events/add/"));
          expect(
            qs(rowOf(add, "due"), { tag: "input", attrs: { type: "date", name: "due" } }),
          ).not.toBeNull();
          const res = await send(client, "/admin/events/add/", {
            day: "2026-10-07",
            due: "2026-10-07",
            note,
          });
          expect(res.status).toBe(303);
          expect(await textOf("due", note)).toBe("2026-10-07");

          const path = `/admin/events/${await idOf(note)}/change/`;
          const doc = await docOf(await client.get(path));
          expect(controlOf(doc, "due")).toEqual({ type: "date", value: "2026-10-07" });
          expect((await send(client, path, formOf(doc))).status).toBe(303);
          expect(await textOf("due", note)).toBe("2026-10-07");
        });

        it("rejects a date written with slashes and keeps the raw value", async () => {
          const res = await send(client, "/admin/events/add/", {
            day: "2026-10-07",
            due: "2026/10/07",
            note: `bad-${timeZone}`,
          });
          expect(res.status).toBe(400);
          const doc = await docOf(res);
          expect(errorsOf(doc, "due")).toContain(messages.invalidDate);
          expect(inputValue(doc, "due")).toBe("2026/10/07");
        });
      },
    );
  }
});
