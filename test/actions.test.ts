import type { Table } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

type RunCtx = { ids: string[]; db: unknown; user: unknown };

async function docOf(res: Response): Promise<Node> {
  return parse(await res.text());
}

describe.each(dialects)("actions ($name)", (fixture) => {
  let t: TestAdmin;
  let client: Client;
  let runs: Record<string, RunCtx[]>;

  const record = (name: string, result?: { message?: string }) => async (ctx: RunCtx) => {
    runs[name]?.push({ ...ctx });
    return result;
  };
  const actions: NonNullable<ModelAdminOptions<Table>["actions"]> = [
    { name: "tag", label: "Tag", run: record("tag", { message: "Tagged!" }) },
    { name: "quiet", label: "Quiet", run: record("quiet") },
    {
      name: "boom",
      label: "Boom",
      run: async () => {
        throw new Error("secret detail");
      },
    },
    { name: "ask", label: "Ask", confirm: true, run: record("ask", { message: "Asked." }) },
  ];

  /** Another admin over the same database, so one PGlite instance serves every configuration. */
  async function adminWith(authors: ModelAdminOptions<Table>): Promise<Client> {
    const admin = createAdmin({
      db: t.db,
      dialect: fixture.dialect,
      basePath: "/admin",
      secret: TEST_SECRET,
      auth: { verifyCredentials: async () => TEST_USER },
    });
    admin.register(t.schema.authors, authors);
    admin.register(t.schema.articles, {});
    const c = createClient((req) => admin.fetch(req));
    await c.login();
    return c;
  }
  /** The first POST needs a session, which any GET issues. */
  async function post(c: Client, path: string, form: Record<string, string | string[]>) {
    if (c.cookie("da_session") === undefined) await c.get("/admin/");
    return c.post(path, form);
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
      models: { authors: { toString: (row) => String(row.name), actions } },
    });
    client = t.client;
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(() => {
    runs = { tag: [], quiet: [], ask: [] };
  });

  it("warns and returns to the list when nothing is selected", async () => {
    const res = await post(client, "/admin/authors/", { action: "tag" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/admin/authors/");
    expect(await flashes(client, res, "warning")).toEqual([messages.noSelection]);
    expect(runs.tag).toHaveLength(0);
  });

  it("flashes an error for an unknown action", async () => {
    const res = await post(client, "/admin/authors/", { action: "nope", _selected: "1" });
    expect(res.status).toBe(303);
    expect(await flashes(client, res, "error")).toEqual([messages.unknownAction]);
    const empty = await post(client, "/admin/authors/", { _selected: "1" });
    expect(await flashes(client, empty, "error")).toEqual([messages.unknownAction]);
  });

  it("runs a custom action once with deduped string ids, db and user, and flashes its message", async () => {
    const res = await post(client, "/admin/authors/", {
      action: "tag",
      _selected: ["2", "1", "2"],
    });
    expect(res.status).toBe(303);
    expect(runs.tag).toHaveLength(1);
    expect(runs.tag?.[0]?.ids).toEqual(["2", "1"]);
    expect(runs.tag?.[0]?.db).toBe(t.db);
    expect(runs.tag?.[0]?.user).toEqual({ id: expect.any(String), name: expect.any(String) });
    expect(await flashes(client, res, "success")).toEqual(["Tagged!"]);
  });

  it("accepts a single _selected value", async () => {
    const res = await post(client, "/admin/authors/", { action: "tag", _selected: "3" });
    expect(res.status).toBe(303);
    expect(runs.tag?.[0]?.ids).toEqual(["3"]);
  });

  it("flashes actionDone when the action returns nothing", async () => {
    const res = await post(client, "/admin/authors/", { action: "quiet", _selected: "1" });
    expect(runs.quiet).toHaveLength(1);
    expect(await flashes(client, res, "success")).toEqual([messages.actionDone]);
  });

  it("flashes actionFailed when the action throws, without the error text", async () => {
    const res = await post(client, "/admin/authors/", { action: "boom", _selected: "1" });
    expect(res.status).toBe(303);
    expect(await flashes(client, res, "error")).toEqual([messages.actionFailed]);
  });

  it("asks for confirmation first, then runs on _confirm=1", async () => {
    const first = await post(client, "/admin/authors/?q=a", {
      action: "ask",
      _selected: ["1", "2"],
    });
    expect(first.status).toBe(200);
    expect(runs.ask).toHaveLength(0);
    const doc = await docOf(first);
    const form = qs(doc, { tag: "form", id: "action-confirm" }) as Node;
    expect(form).not.toBeNull();
    expect(attr(form, "method")).toBe("post");
    expect(attr(form, "action")).toBe("/admin/authors/?q=a");
    const hidden = (name: string) =>
      qsa(form, { tag: "input", attrs: { name } }).map((i) => attr(i, "value"));
    expect(hidden("_selected")).toEqual(["1", "2"]);
    expect(hidden("action")).toEqual(["ask"]);
    expect(hidden("_confirm")).toEqual(["1"]);
    expect(hidden("_csrf")).toHaveLength(1);
    const items = qsa(qs(doc, { tag: "ul", cls: "objects" }) as Node, { tag: "li" });
    expect(items.map((li) => text(li).trim())).toEqual(["alice", "bob"]);
    expect(text(form)).toContain(messages.confirmAction("Ask"));
    expect(text(form)).toContain(messages.confirmYes);
    expect(text(form)).toContain(messages.cancel);

    const second = await post(client, "/admin/authors/", {
      action: "ask",
      _selected: ["1", "2"],
      _confirm: "1",
    });
    expect(second.status).toBe(303);
    expect(runs.ask).toHaveLength(1);
    expect(runs.ask?.[0]?.ids).toEqual(["1", "2"]);
    expect(await flashes(client, second, "success")).toEqual(["Asked."]);
  });

  it("warns and skips the confirmation page when no selected row exists any more", async () => {
    const res = await post(client, "/admin/authors/", { action: "ask", _selected: "999999" });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe("/admin/authors/");
    expect(await flashes(client, res, "warning")).toEqual([messages.noSelection]);
    expect(runs.ask).toHaveLength(0);
  });

  it("redirects to the list URL plus the original query string", async () => {
    const query = "?q=a&o=-id";
    const cases: Record<string, string | string[]>[] = [
      { action: "quiet", _selected: "1" },
      { action: "quiet" },
      { action: "nope", _selected: "1" },
      { action: "boom", _selected: "1" },
    ];
    for (const form of cases) {
      const res = await post(client, `/admin/authors/${query}`, form);
      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe(`/admin/authors/${query}`);
    }
  });

  it("answers 404 for an unknown model", async () => {
    expect((await post(client, "/admin/nope/", { action: "x", _selected: "1" })).status).toBe(404);
  });

  it("requires change for custom actions and delete for delete_selected (403)", async () => {
    const noChange = await adminWith({
      permissions: { change: false },
      actions: [{ name: "tag", label: "Tag", run: record("tag") }],
    });
    const res = await post(noChange, "/admin/authors/", { action: "tag", _selected: "1" });
    expect(res.status).toBe(403);
    expect(runs.tag).toHaveLength(0);
    // delete stays allowed, so change does not gate delete_selected
    const del = await post(noChange, "/admin/authors/", {
      action: "delete_selected",
      _selected: "999",
    });
    expect(del.status).not.toBe(403);

    const noDelete = await adminWith({
      permissions: { delete: false },
      actions: [{ name: "tag", label: "Tag", run: record("tag") }],
    });
    expect(
      (await post(noDelete, "/admin/authors/", { action: "delete_selected", _selected: "1" }))
        .status,
    ).toBe(403);
    expect(
      (await post(noDelete, "/admin/authors/", { action: "tag", _selected: "1" })).status,
    ).toBe(303);
    expect(runs.tag).toHaveLength(1);
  });
});
