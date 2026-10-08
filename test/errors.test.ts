import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { classifyDbError, describeForLog, isDbError } from "../src/data/errors.js";
import { createRepository } from "../src/data/repository.js";
import { introspectTable } from "../src/introspect/index.js";
import { type DialectFixture, dialects, type SetupResult } from "./helpers/db.js";

const SECRET = "secretvalue";

async function thrown(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("expected the call to reject");
}

describe.each(dialects)("data/errors ($name)", (fx: DialectFixture) => {
  const open: SetupResult[] = [];
  afterEach(async () => {
    await Promise.all(open.splice(0).map((s) => s.close()));
  });

  async function make() {
    const s = await fx.setup();
    open.push(s);
    const repo = createRepository({ db: s.db, dialect: fx.dialect, timeZone: "UTC" });
    const authors = introspectTable(s.schema.authors, fx.dialect);
    const articles = introspectTable(s.schema.articles, fx.dialect);
    return {
      unique: () => thrown(repo.create(authors, { name: "alice" })),
      foreignKey: () => thrown(repo.create(articles, { title: "t", authorId: 9999 })),
      notNull: () => thrown(repo.create(authors, { name: null })),
      secret: async () => {
        await repo.create(authors, { name: SECRET });
        return thrown(repo.create(authors, { name: SECRET }));
      },
    };
  }

  it("classifies real driver errors", async () => {
    const m = await make();
    expect(classifyDbError(await m.unique())).toBe("unique");
    expect(classifyDbError(await m.foreignKey())).toBe("foreignKey");
    expect(classifyDbError(await m.notNull())).toBe("notNull");
    expect(classifyDbError(new Error("x"))).toBe("other");
  });

  it("recognizes real driver errors as DB errors", async () => {
    const m = await make();
    expect(isDbError(await m.unique())).toBe(true);
    expect(isDbError(await m.foreignKey())).toBe(true);
    expect(isDbError(await m.notNull())).toBe(true);
    expect(isDbError(new Error("x"))).toBe(false);
  });

  it("describes errors for logs without the bound value", async () => {
    const m = await make();
    const err = await m.secret();
    const line = describeForLog(err);
    expect(line).toMatch(/^unique \S+ \S+$/);
    expect(line).not.toContain(SECRET);
    // Sanity: the unredacted message of PG errors does embed the value.
    if (fx.name === "pglite") expect(String((err as Error).message)).toContain(SECRET);
  });
});

describe("data/errors (synthetic)", () => {
  it("reads codes along the cause chain, up to 5 levels", () => {
    const wrap = (cause: unknown) => new Error("w", { cause });
    const deep = (n: number) => {
      let e: unknown = Object.assign(new Error("db"), { code: "23505" });
      for (let i = 0; i < n; i++) e = wrap(e);
      return e;
    };
    expect(classifyDbError(deep(5))).toBe("unique");
    expect(classifyDbError(deep(6))).toBe("other");
    expect(isDbError(deep(5))).toBe(true);
    expect(isDbError(deep(6))).toBe(false);
  });

  it("treats a DrizzleQueryError without any code as a DB error of kind other", () => {
    const err = new DrizzleQueryError("select 1", [], new Error("no code"));
    expect(isDbError(err)).toBe(true);
    expect(classifyDbError(err)).toBe("other");
  });

  it("maps every documented code", () => {
    const k = (code: string) => classifyDbError({ code });
    expect(k("SQLITE_CONSTRAINT_UNIQUE")).toBe("unique");
    expect(k("SQLITE_CONSTRAINT_PRIMARYKEY")).toBe("unique");
    expect(k("23505")).toBe("unique");
    expect(k("SQLITE_CONSTRAINT_FOREIGNKEY")).toBe("foreignKey");
    expect(k("23503")).toBe("foreignKey");
    expect(k("SQLITE_CONSTRAINT_NOTNULL")).toBe("notNull");
    expect(k("23502")).toBe("notNull");
    expect(k("42883")).toBe("other");
  });

  it("handles non-object inputs and circular causes", () => {
    expect(classifyDbError(null)).toBe("other");
    expect(isDbError("23505")).toBe(false);
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(isDbError(a)).toBe(false);
    expect(describeForLog(undefined)).toBe("other unknown -");
  });
});
