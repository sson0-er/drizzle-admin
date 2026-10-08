import type { Table } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdmin, type ModelAdminOptions } from "../src/index.js";
import { messages } from "../src/messages.js";
import {
  type Client,
  createClient,
  makeAdmin,
  TEST_SECRET,
  type TestAdmin,
} from "./helpers/app.js";
import { dialects } from "./helpers/db.js";
import { attr, type Node, parse, qs, qsa, text } from "./helpers/html.js";

type Rec = Record<string, unknown>;
type RawDb = {
  select(): { from(table: Table): PromiseLike<Rec[]> };
  insert(table: Table): { values(rows: Rec): { returning(): PromiseLike<Rec[]> } };
};

async function docOf(res: Response): Promise<Node> {
  return parse(await res.text());
}

/** The first POST needs a session, which any GET issues. */
async function send(client: Client, path: string) {
  if (client.cookie("da_session") === undefined) await client.get("/admin/");
  return client.post(path);
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
  function adminWith(authors: ModelAdminOptions<Table>): Client {
    const admin = createAdmin({
      db: t.db,
      dialect: fixture.dialect,
      basePath: "/admin",
      secret: TEST_SECRET,
      auth: { verifyCredentials: async () => null },
    });
    admin.register(table("authors"), authors);
    admin.register(table("articles"), {});
    return createClient((req) => admin.fetch(req));
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
    const c = adminWith({
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
    const c = adminWith({
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
});
