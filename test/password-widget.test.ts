import { eq, type Table } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeAdmin, type TestAdmin } from "./helpers/app.js";
import { dialects } from "./helpers/db.js";
import { attr, type Element, parse, qs, qsa, text } from "./helpers/html.js";

type Rec = Record<string, unknown>;
type RawDb = {
  select(): { from(table: Table): { where(condition: unknown): PromiseLike<Rec[]> } };
  update(table: Table): { set(values: Rec): { where(condition: unknown): PromiseLike<unknown> } };
};

describe.each(dialects)("password widget ($name)", (fixture) => {
  let t: TestAdmin;
  let viewOnly: TestAdmin;
  const raw = (admin: TestAdmin = t) => admin.db as RawDb;
  const kv = (admin: TestAdmin = t) => admin.schema.kv as Table & { key: never };
  const seed = (admin: TestAdmin) =>
    raw(admin)
      .update(kv(admin))
      .set({ value: "s3cret" })
      .where(eq(kv(admin).key, "a" as never));
  const storedValue = async () => {
    const [row] = await raw()
      .select()
      .from(kv())
      .where(eq(kv().key, "a" as never));
    return row?.value;
  };

  beforeAll(async () => {
    t = await makeAdmin(fixture, {
      models: {
        kv: {
          widgets: { value: "password" },
          listDisplay: ["key", "value"],
          // Forces a 400 re-render only for this submission so the other tests can still save.
          validate: (data) => (data.value === "typed" ? { value: "rejected" } : undefined),
        },
      },
    });
    viewOnly = await makeAdmin(fixture, {
      models: { kv: { widgets: { value: "password" }, permissions: { change: false } } },
    });
  });
  beforeEach(async () => {
    await seed(t);
    await seed(viewOnly);
  });
  afterAll(async () => {
    await t.close();
    await viewOnly.close();
  });

  it.each([
    { name: "keeps the stored value on an empty submission", submitted: "", stored: "s3cret" },
    { name: "saves a non-empty submission", submitted: "new", stored: "new" },
  ])("$name", async ({ submitted, stored }) => {
    await t.client.get("/admin/kv/a/change/");
    const res = await t.client.post("/admin/kv/a/change/", { value: submitted });
    expect(res.status).toBe(303);
    expect(await storedValue()).toBe(stored);
  });

  it("never puts the stored value on the change page and leaves the input empty", async () => {
    const html = await (await t.client.get("/admin/kv/a/change/")).text();
    const input = qs(parse(html), { tag: "input", attrs: { name: "value" } });
    expect(input && attr(input, "type")).toBe("password");
    expect(input && (attr(input, "value") ?? "")).toBe("");
    expect(html).not.toContain("s3cret");
  });

  it("does not echo a rejected submission on the 400 re-render", async () => {
    const res = await t.client.post("/admin/kv/a/change/", { value: "typed" });
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("rejected");
    expect(html).not.toContain("typed");
    expect(await storedValue()).toBe("s3cret");
  });

  it("masks the list cell", async () => {
    const html = await (await t.client.get("/admin/kv/")).text();
    const table = qs(parse(html), { tag: "table", id: "result_list" }) as Element;
    const keys = qsa(table, { tag: "th" }).flatMap((th) => attr(th, "data-key") ?? []);
    const row = qsa(qs(table, { tag: "tbody" }) as Element, { tag: "tr" }).find((tr) =>
      text(tr).includes("a"),
    ) as Element;
    const cells = qsa(row, { tag: "td" }).slice(1);
    expect(text(cells[keys.indexOf("value")] as Element).trim()).toBe("********");
    expect(html).not.toContain("s3cret");
  });

  it("masks the value on a view-only change page", async () => {
    const res = await viewOnly.client.get("/admin/kv/a/change/");
    expect(res.status).toBe(200);
    const html = await res.text();
    const row = qs(parse(html), { tag: "div", attrs: { "data-field": "value" } }) as Element;
    expect(text(row)).toContain("********");
    expect(html).not.toContain("s3cret");
  });
});
