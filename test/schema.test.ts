import { describe, expect, it, vi } from "vitest";
import type { FormBody } from "../src/forms/coerce.js";
import type { FormField, FormMode } from "../src/forms/fields.js";
import { buildZodSchema, parseWithSchema } from "../src/forms/schema.js";
import { validateSubmission } from "../src/forms/validate.js";
import type { FieldMeta } from "../src/introspect/index.js";
import { messages } from "../src/messages.js";
import type { ResolvedModel } from "../src/types.js";

function field(key: string, meta: Partial<FieldMeta> = {}): FormField {
  const full: FieldMeta = {
    key,
    dbName: key,
    kind: "string",
    notNull: true,
    hasDefault: false,
    isPrimaryKey: false,
    isAutoIncrement: false,
    isInteger: false,
    isLongText: false,
    isDateOnly: false,
    isGenerated: false,
    ...meta,
  };
  return { key, label: key, meta: full, widget: "text", editable: true, required: full.notNull };
}

function check(fields: FormField[], data: Record<string, unknown>, mode: FormMode = "add") {
  return parseWithSchema(buildZodSchema(fields, mode), data);
}

describe("buildZodSchema", () => {
  it("accepts null only for nullable fields", () => {
    expect(check([field("a", { notNull: false })], { a: null }).ok).toBe(true);
    expect(check([field("a")], { a: null })).toEqual({
      ok: false,
      errors: { a: messages.invalidValue },
    });
  });

  it("makes notNull + hasDefault optional on add only", () => {
    const f = field("a", { hasDefault: true });
    expect(check([f], {}, "add").ok).toBe(true);
    expect(check([f], {}, "change").ok).toBe(false);
  });

  it.each<{ mode: FormMode; ok: boolean }>([
    { mode: "change", ok: true },
    { mode: "add", ok: false },
  ])("a notNull password field accepts {} on $mode: $ok", ({ mode, ok }) => {
    const f = { ...field("a"), widget: "password" as const };
    expect(check([f], {}, mode).ok).toBe(ok);
  });

  it("rejects a non-integer on an integer field with invalidValue", () => {
    const f = field("n", { kind: "number", isInteger: true });
    expect(check([f], { n: 1.5 })).toEqual({ ok: false, errors: { n: messages.invalidValue } });
    expect(check([f], { n: 2 }).ok).toBe(true);
    expect(check([field("n", { kind: "number" })], { n: 1.5 }).ok).toBe(true);
  });

  it("validates each kind and maps failures to invalidValue, first issue per field", () => {
    const fields = [
      field("s"),
      field("b", { kind: "boolean" }),
      field("big", { kind: "bigint" }),
      field("d", { kind: "date" }),
      field("j", { kind: "json" }),
      field("e", { kind: "enum", enumValues: ["x", "y"] }),
    ];
    const good = { s: "a", b: true, big: 1n, d: new Date(0), j: { any: 1 }, e: "x" };
    expect(check(fields, good).ok).toBe(true);
    const bad = check(fields, { ...good, s: 1, e: "z", d: "nope" });
    expect(bad).toEqual({
      ok: false,
      errors: { s: messages.invalidValue, e: messages.invalidValue, d: messages.invalidValue },
    });
  });

  it("returns the parsed data on success", () => {
    expect(check([field("a")], { a: "v", extra: 1 })).toEqual({ ok: true, data: { a: "v" } });
  });
});

function model(validate?: ResolvedModel["validate"]): ResolvedModel {
  return { validate } as ResolvedModel;
}

const fields = [field("name"), field("age", { kind: "number", isInteger: true })];

async function submit(
  body: FormBody,
  validate?: ResolvedModel["validate"],
  mode: FormMode = "add",
) {
  return validateSubmission({ model: model(validate), fields, body, mode, timeZone: "Asia/Tokyo" });
}

describe("validateSubmission", () => {
  it("returns the coerced data when everything passes", async () => {
    expect(await submit({ name: "a", age: "3" })).toEqual({
      ok: true,
      data: { name: "a", age: 3 },
    });
  });

  it("stops at coercion errors before zod and validate", async () => {
    const validate = vi.fn();
    const result = await submit({ name: "a", age: "x" }, validate);
    expect(result).toEqual({
      ok: false,
      fieldErrors: { age: messages.invalidNumber },
      formErrors: [],
      values: { name: "a", age: "x" },
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it("stops at zod errors before validate", async () => {
    const validate = vi.fn();
    // Coercion accepts this integer, but zod's .int() rejects integers beyond the safe range.
    const result = await submit({ name: "a", age: "9007199254740993" }, validate);
    expect(result).toEqual({
      ok: false,
      fieldErrors: { age: messages.invalidValue },
      formErrors: [],
      values: { name: "a", age: "9007199254740993" },
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it("maps validate errors to field errors for editable keys and form errors otherwise", async () => {
    const result = await submit({ name: "a", age: "3" }, () => ({ name: "m1", other: "m2" }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: { name: "m1" },
      formErrors: ["m2"],
      values: { name: "a", age: "3" },
    });
  });

  it("passes { mode } to validate, awaits it, and treats no errors as ok", async () => {
    const validate = vi.fn(async () => undefined);
    expect((await submit({ name: "a", age: "3" }, validate, "change")).ok).toBe(true);
    expect(validate).toHaveBeenCalledWith({ name: "a", age: 3 }, { mode: "change" });
    expect((await submit({ name: "a", age: "3" }, async () => ({}))).ok).toBe(true);
  });

  it("does not catch a throwing validate", async () => {
    await expect(
      submit({ name: "a", age: "3" }, () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
