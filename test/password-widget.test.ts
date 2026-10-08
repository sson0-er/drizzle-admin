import { eq, type Table } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeAdmin, type TestAdmin } from "./helpers/app.js";
import { dialects } from "./helpers/db.js";

type Rec = Record<string, unknown>;
type RawDb = {
  select(): { from(table: Table): { where(condition: unknown): PromiseLike<Rec[]> } };
  update(table: Table): { set(values: Rec): { where(condition: unknown): PromiseLike<unknown> } };
};

describe.each(dialects)("password widget ($name)", (fixture) => {
  let t: TestAdmin;
  const raw = () => t.db as RawDb;
  const kv = () => t.schema.kv as Table & { key: never };
  const storedValue = async () => {
    const [row] = await raw()
      .select()
      .from(kv())
      .where(eq(kv().key, "a" as never));
    return row?.value;
  };

  beforeAll(async () => {
    t = await makeAdmin(fixture, { models: { kv: { widgets: { value: "password" } } } });
    await raw()
      .update(kv())
      .set({ value: "s3cret" })
      .where(eq(kv().key, "a" as never));
  });
  afterAll(() => t.close());

  it.each([
    { name: "keeps the stored value on an empty submission", submitted: "", stored: "s3cret" },
    { name: "saves a non-empty submission", submitted: "new", stored: "new" },
  ])("$name", async ({ submitted, stored }) => {
    await t.client.get("/admin/kv/a/change/");
    const res = await t.client.post("/admin/kv/a/change/", { value: submitted });
    expect(res.status).toBe(303);
    expect(await storedValue()).toBe(stored);
  });
});
