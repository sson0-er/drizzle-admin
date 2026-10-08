import { type Column, eq, getTableColumns, type Table } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdmin, type ModelAdminOptions } from "../src/index.js";
import { messages } from "../src/messages.js";
import {
  type Client,
  createClient,
  makeAdmin,
  TEST_SECRET,
  TEST_USER,
  type TestAdmin,
} from "./helpers/app.js";
import { dialects } from "./helpers/db.js";
import { attr, type Node, parse, qs, qsa, text } from "./helpers/html.js";

type Rec = Record<string, unknown>;
type RawDb = {
  select(): { from(table: Table): PromiseLike<Rec[]> };
  insert(table: Table): { values(rows: Rec): { returning(): PromiseLike<Rec[]> } };
  delete(table: Table): { where(condition: unknown): PromiseLike<unknown> };
};

async function docOf(res: Response): Promise<Node> {
  return parse(await res.text());
}

/** The first POST needs a session, which any GET issues. */
async function send(client: Client, path: string, form: Record<string, string | string[]> = {}) {
  if (client.cookie("da_session") === undefined) await client.get("/admin/");
  return client.post(path, form);
}

describe.each(dialects)("delete ($name)", (fixture) => {
  let t: TestAdmin;
  let client: Client;
  const raw = () => t.db as RawDb;
  const table = (name: "authors" | "articles"): Table => {
    const found = t.schema[name];
    if (found === undefined) throw new Error(`no table ${name}`);
    return found;
  };
  const rows = (name: "authors" | "articles") => raw().select().from(table(name));
  async function addAuthor(name: string): Promise<Rec> {
    const [row] = await raw().insert(table("authors")).values({ name }).returning();
    if (row === undefined) throw new Error("insert returned no row");
    return row;
  }
  /** Another admin over the same database, so one PGlite instance serves every configuration. */
  async function adminWith(authors: ModelAdminOptions<Table>, db: unknown = t.db): Promise<Client> {
    const admin = createAdmin({
      db,
      dialect: fixture.dialect,
      basePath: "/admin",
      secret: TEST_SECRET,
      auth: { verifyCredentials: async () => TEST_USER },
    });
    admin.register(table("authors"), authors);
    admin.register(table("articles"), {});
    const c = createClient((req) => admin.fetch(req));
    await c.login();
    return c;
  }
  /** The same database, but every `delete()` throws `failure` before reaching the driver. */
  function dbFailingOnDelete(failure: Error): unknown {
    return new Proxy(t.db as object, {
      get: (target, prop) =>
        prop === "delete"
          ? () => {
              throw failure;
            }
          : Reflect.get(target, prop, target),
    });
  }
  async function flashes(c: Client, res: Response, cls?: string) {
    const doc = await docOf(await c.get(res.headers.get("Location") ?? ""));
    const list = qs(doc, { tag: "ul", cls: "messagelist" });
    if (list === null) return [];
    return qsa(list, { tag: "li", ...(cls === undefined ? {} : { cls }) }).map((li) =>
      text(li).trim(),
    );
  }

  beforeAll(async () => {
    t = await makeAdmin(fixture, {
      models: { authors: { toString: (row) => String(row.name) } },
    });
    client = t.client;
  });
  afterAll(async () => {
    await t.close();
  });

  it("shows the confirmation page for an existing row", async () => {
    const author = await addAuthor("to-confirm");
    const res = await client.get(`/admin/authors/${String(author.id)}/delete/`);
    expect(res.status).toBe(200);
    const doc = await docOf(res);
    const form = qs(doc, { tag: "form", id: "delete-form" });
    expect(form).not.toBeNull();
    expect(attr(form as Node, "method")).toBe("post");
    expect(qs(form as Node, { tag: "input", attrs: { name: "_csrf" } })).not.toBeNull();
    const confirm = qs(doc, { tag: "p", cls: "confirm-text" });
    expect(text(confirm as Node)).toContain(messages.confirmDelete("to-confirm"));
    expect(qs(doc, { tag: "button", attrs: { type: "submit" } })).not.toBeNull();
    const cancel = qsa(doc, { tag: "a" }).find((a) => text(a).trim() === messages.cancel);
    expect(attr(cancel as Node, "href")).toBe(`/admin/authors/${String(author.id)}/change/`);
  });

  it("answers 404 for an unknown primary key or model", async () => {
    expect((await client.get("/admin/authors/9999/delete/")).status).toBe(404);
    expect((await send(client, "/admin/authors/9999/delete/")).status).toBe(404);
    expect((await client.get("/admin/nope/1/delete/")).status).toBe(404);
  });

  it("deletes the row and flashes the success message on the list", async () => {
    const author = await addAuthor("to-delete");
    const res = await send(client, `/admin/authors/${String(author.id)}/delete/`);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/admin/authors/");
    expect((await rows("authors")).some((r) => r.id === author.id)).toBe(false);
    expect(await flashes(client, res)).toEqual([messages.deleted("to-delete")]);
  });

  it("flashes alreadyDeleted when the row vanishes after beforeDelete", async () => {
    const author = await addAuthor("vanishing");
    const c = await adminWith({
      toString: (row) => String(row.name),
      hooks: {
        // Removes the row itself, so the delete that follows matches 0 rows.
        beforeDelete: async (row, ctx) => {
          const id = getTableColumns(table("authors")).id as Column;
          await (ctx.db as RawDb).delete(table("authors")).where(eq(id, row.id));
        },
      },
    });
    const res = await send(c, `/admin/authors/${String(author.id)}/delete/`);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/admin/authors/");
    // The flash is consumed by the first GET, so read all items and their level from one page.
    const doc = await docOf(await c.get(res.headers.get("Location") ?? ""));
    const items = qsa(qs(doc, { tag: "ul", cls: "messagelist" }) as Node, { tag: "li" });
    expect(items.map((li) => text(li).trim())).toEqual([messages.alreadyDeleted("vanishing")]);
    expect(items.map((li) => attr(li, "class"))).toEqual([expect.stringContaining("warning")]);
  });

  it("keeps an author that an article references and flashes the FK error", async () => {
    // Fixture author 1 owns articles.
    const res = await send(client, "/admin/authors/1/delete/");
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/admin/authors/");
    expect(await flashes(client, res, "error")).toEqual([messages.dbForeignKey]);
    expect((await rows("authors")).some((r) => r.id === 1)).toBe(true);
  });

  it("calls beforeDelete once with the row and { mode, user, db }", async () => {
    const author = await addAuthor("hooked");
    const calls: { row: Rec; ctx: Rec }[] = [];
    const c = await adminWith({
      hooks: { beforeDelete: (row, ctx) => void calls.push({ row, ctx: { ...ctx } }) },
    });
    const res = await send(c, `/admin/authors/${String(author.id)}/delete/`);
    expect(res.status).toBe(303);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.row).toEqual(author);
    expect(calls[0]?.ctx).toEqual({
      mode: "delete",
      user: { id: expect.any(String), name: expect.any(String) },
      db: expect.anything(),
    });
    expect(calls[0]?.ctx.db).toBe(t.db);
    expect((await rows("authors")).some((r) => r.id === author.id)).toBe(false);
  });

  it("turns a throwing beforeDelete into an error flash and keeps the row", async () => {
    const author = await addAuthor("protected");
    const c = await adminWith({
      hooks: {
        beforeDelete: () => {
          throw new Error("secret detail");
        },
      },
    });
    const res = await send(c, `/admin/authors/${String(author.id)}/delete/`);
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/admin/authors/");
    const shown = await flashes(c, res, "error");
    expect(shown).toEqual([messages.hookFailed]);
    expect((await rows("authors")).some((r) => r.id === author.id)).toBe(true);
  });

  describe("bulk delete (delete_selected)", () => {
    const bulk = (c: Client, form: Record<string, string | string[]>, query = "") =>
      send(c, `/admin/authors/${query}`, form);

    it("lists each row's toString on the confirmation page and deletes nothing", async () => {
      const a = await addAuthor("bulk-a");
      const b = await addAuthor("bulk-b");
      const res = await bulk(
        client,
        {
          action: "delete_selected",
          _selected: [String(a.id), String(b.id)],
        },
        "?q=bulk",
      );
      expect(res.status).toBe(200);
      const doc = await docOf(res);
      const form = qs(doc, { tag: "form", id: "action-confirm" }) as Node;
      expect(attr(form, "action")).toBe("/admin/authors/?q=bulk");
      const ul = qs(doc, { tag: "ul", cls: "objects" }) as Node;
      expect(qsa(ul, { tag: "li" }).map((li) => text(li).trim())).toEqual(["bulk-a", "bulk-b"]);
      expect(
        qsa(form, { tag: "input", attrs: { name: "_selected" } }).map((i) => attr(i, "value")),
      ).toEqual([String(a.id), String(b.id)]);
      expect((await rows("authors")).filter((r) => r.id === a.id || r.id === b.id)).toHaveLength(2);
    });

    it("deletes the rows on _confirm=1 and flashes deletedMany", async () => {
      const a = await addAuthor("gone-a");
      const b = await addAuthor("gone-b");
      const res = await bulk(client, {
        action: "delete_selected",
        _selected: [String(a.id), String(b.id)],
        _confirm: "1",
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/admin/authors/");
      expect((await rows("authors")).some((r) => r.id === a.id || r.id === b.id)).toBe(false);
      expect(await flashes(client, res, "success")).toEqual([messages.deletedMany(2)]);
    });

    it("calls beforeDelete once per row with mode delete", async () => {
      const a = await addAuthor("hook-a");
      const b = await addAuthor("hook-b");
      const calls: { row: Rec; mode: unknown }[] = [];
      const c = await adminWith({
        hooks: { beforeDelete: (row, ctx) => void calls.push({ row, mode: ctx.mode }) },
      });
      const res = await bulk(c, {
        action: "delete_selected",
        _selected: [String(a.id), String(b.id)],
        _confirm: "1",
      });
      expect(res.status).toBe(303);
      expect(calls.map((x) => x.row.id).sort()).toEqual([a.id, b.id].sort());
      expect(calls.every((x) => x.mode === "delete")).toBe(true);
    });

    it("keeps every row when a beforeDelete throws", async () => {
      const a = await addAuthor("keep-a");
      const c = await adminWith({
        hooks: {
          beforeDelete: () => {
            throw new Error("secret detail");
          },
        },
      });
      const res = await bulk(c, {
        action: "delete_selected",
        _selected: String(a.id),
        _confirm: "1",
      });
      expect(res.status).toBe(303);
      expect(await flashes(c, res, "error")).toEqual([messages.hookFailed]);
      expect((await rows("authors")).some((r) => r.id === a.id)).toBe(true);
    });

    it("flashes dbForeignKey and keeps the rows when an article references one", async () => {
      const free = await addAuthor("free");
      // Fixture author 1 owns articles.
      const res = await bulk(client, {
        action: "delete_selected",
        _selected: ["1", String(free.id)],
        _confirm: "1",
      });
      expect(res.status).toBe(303);
      expect(await flashes(client, res, "error")).toEqual([messages.dbForeignKey]);
      const ids = (await rows("authors")).map((r) => r.id);
      expect(ids).toContain(1);
      expect(ids).toContain(free.id);
    });
  });

  describe("failures other than a foreign key", () => {
    // A DB error is any error carrying a string `code`; a plain Error is a bug.
    const dbError = () => Object.assign(new Error("secret detail"), { code: "XX000" });
    const requests = [
      {
        name: "single delete",
        path: (id: unknown) => `/admin/authors/${String(id)}/delete/`,
        form: () => ({}),
      },
      {
        name: "delete_selected with _confirm=1",
        path: () => "/admin/authors/",
        form: (id: unknown) => ({
          action: "delete_selected",
          _selected: String(id),
          _confirm: "1",
        }),
      },
    ];

    it.each(requests)("$name with a non-FK DB error flashes dbOther", async (r) => {
      const author = await addAuthor(`db-other ${r.name}`);
      const c = await adminWith({}, dbFailingOnDelete(dbError()));
      const res = await send(c, r.path(author.id), r.form(author.id));
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/admin/authors/");
      expect(await flashes(c, res, "error")).toEqual([messages.dbOther]);
      expect((await rows("authors")).some((x) => x.id === author.id)).toBe(true);
    });

    it.each(requests)("$name with a non-DB error answers 500", async (r) => {
      const author = await addAuthor(`non-db ${r.name}`);
      const c = await adminWith({}, dbFailingOnDelete(new Error("a bug")));
      // onError logs the error; keep the test output clean.
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const res = await send(c, r.path(author.id), r.form(author.id));
        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain("a bug");
      } finally {
        log.mockRestore();
      }
      expect((await rows("authors")).some((x) => x.id === author.id)).toBe(true);
    });
  });

  describe("delete_selected with only vanished rows", () => {
    it.each([
      ["without _confirm", {}],
      ["with _confirm=1", { _confirm: "1" }],
    ])("%s flashes noSelection and deletes nothing", async (_name, extra) => {
      const before = (await rows("authors")).length;
      const res = await send(client, "/admin/authors/", {
        action: "delete_selected",
        _selected: "999999",
        ...extra,
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("/admin/authors/");
      expect(await flashes(client, res, "warning")).toEqual([messages.noSelection]);
      expect(await rows("authors")).toHaveLength(before);
    });
  });
});
