import { describe, expect, it } from "vitest";
import { createAdmin, resolvedModels } from "../src/admin.js";
import { ACTION_PERMISSION, can, canAny, type Perm } from "../src/auth/permissions.js";
import type { AdminUser, ResolvedModel } from "../src/types.js";
import { authors } from "./fixtures/schema-sqlite.js";

const alice: AdminUser = { id: "1", name: "alice" };
const bob: AdminUser = { id: "2", name: "bob" };

function modelWith(permissions: Parameters<ReturnType<typeof createAdmin>["register"]>[1]) {
  const admin = createAdmin({
    db: {},
    dialect: "sqlite",
    basePath: "/admin",
    secret: "s".repeat(32),
    auth: { verifyCredentials: async () => null },
  });
  admin.register(authors, permissions);
  return resolvedModels(admin).get("authors") as ResolvedModel;
}

describe("can", () => {
  it("honours boolean true and false", () => {
    const model = modelWith({ permissions: { view: true, add: false } });
    expect(can(model, "view", alice)).toBe(true);
    expect(can(model, "add", alice)).toBe(false);
  });

  it("passes the user to a function permission", () => {
    const model = modelWith({ permissions: { change: (u) => u.id === "1" } });
    expect(can(model, "change", alice)).toBe(true);
    expect(can(model, "change", bob)).toBe(false);
  });

  it("defaults to true when unspecified", () => {
    const model = modelWith({});
    for (const perm of ["view", "add", "change", "delete"] as Perm[]) {
      expect(can(model, perm, alice)).toBe(true);
    }
  });

  it("evaluates each permission independently", () => {
    const model = modelWith({ permissions: { delete: false } });
    expect(can(model, "delete", alice)).toBe(false);
    expect(can(model, "change", alice)).toBe(true);
  });
});

describe("canAny", () => {
  it.each([
    { name: "{}", permissions: {}, user: alice, expected: true },
    { name: "view false", permissions: { view: false }, user: alice, expected: false },
    {
      name: "view false, add true",
      permissions: { view: false, add: true },
      user: alice,
      expected: true,
    },
    {
      name: "view by id, alice",
      permissions: { view: (u: AdminUser) => u.id === "1" },
      user: alice,
      expected: true,
    },
    {
      name: "view by id, bob",
      permissions: { view: (u: AdminUser) => u.id === "1" },
      user: bob,
      expected: false,
    },
  ])("$name -> $expected", ({ permissions, user, expected }) => {
    expect(canAny(modelWith({ permissions }), user)).toBe(expected);
  });
});

describe("ACTION_PERMISSION", () => {
  it("is change", () => {
    expect(ACTION_PERMISSION).toBe("change");
  });
});
