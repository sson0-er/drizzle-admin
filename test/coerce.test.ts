import { describe, expect, it } from "vitest";
import { coerceForm, type FormBody, rawValues } from "../src/forms/coerce.js";
import type { FormField, FormMode } from "../src/forms/fields.js";
import type { FieldMeta } from "../src/introspect/index.js";
import { messages } from "../src/messages.js";

const TOKYO = "Asia/Tokyo";

function field(key: string, meta: Partial<FieldMeta> = {}, widget: FormField["widget"] = "text") {
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
  return {
    key,
    label: key,
    meta: full,
    widget,
    editable: true,
    required: full.notNull,
  } satisfies FormField;
}

function run(
  f: FormField,
  value: FormBody[string] | undefined,
  mode: FormMode = "add",
  tz = TOKYO,
) {
  const body: FormBody = value === undefined ? {} : { [f.key]: value };
  return coerceForm([f], body, mode, tz);
}

describe("coerceForm: boolean", () => {
  const f = field("flag", { kind: "boolean" }, "checkbox");

  it("is true when present and not 0/false", () => {
    expect(run(f, "on").data).toEqual({ flag: true });
    expect(run(f, "1").data).toEqual({ flag: true });
  });

  it("is false for 0, false and a missing key, never an error", () => {
    expect(run(f, "0")).toEqual({ data: { flag: false }, errors: {} });
    expect(run(f, "false")).toEqual({ data: { flag: false }, errors: {} });
    expect(run(f, undefined)).toEqual({ data: { flag: false }, errors: {} });
    expect(run(f, "", "change")).toEqual({ data: { flag: true }, errors: {} });
  });
});

describe("coerceForm: empty values", () => {
  it("gives null for a nullable field", () => {
    const f = field("n", { notNull: false });
    expect(run(f, "").data).toEqual({ n: null });
    expect(run(f, undefined).data).toEqual({ n: null });
  });

  it("omits the key for notNull + hasDefault on add", () => {
    const f = field("n", { hasDefault: true });
    expect(run(f, "")).toEqual({ data: {}, errors: {} });
    expect(run(f, undefined)).toEqual({ data: {}, errors: {} });
  });

  it("is required for notNull without default and for a default in change mode", () => {
    expect(run(field("n"), "").errors).toEqual({ n: messages.required });
    const withDefault = field("n", { hasDefault: true });
    expect(run(withDefault, "", "change")).toEqual({ data: {}, errors: { n: messages.required } });
  });
});

describe("coerceForm: password widget", () => {
  const password = (meta: Partial<FieldMeta>) => field("value", meta, "password");

  it.each<{
    name: string;
    meta: Partial<FieldMeta>;
    mode: FormMode;
    value: string | undefined;
    expected: ReturnType<typeof run>;
  }>([
    {
      name: "change + empty",
      meta: {},
      mode: "change",
      value: "",
      expected: { data: {}, errors: {} },
    },
    {
      name: "change + missing key",
      meta: {},
      mode: "change",
      value: undefined,
      expected: { data: {}, errors: {} },
    },
    {
      name: "change + empty on a nullable field",
      meta: { notNull: false },
      mode: "change",
      value: "",
      expected: { data: {}, errors: {} },
    },
    {
      name: "change + new value",
      meta: {},
      mode: "change",
      value: "new",
      expected: { data: { value: "new" }, errors: {} },
    },
    {
      name: "add + empty on a nullable field",
      meta: { notNull: false },
      mode: "add",
      value: "",
      expected: { data: { value: null }, errors: {} },
    },
    {
      name: "add + empty on a notNull field without default",
      meta: {},
      mode: "add",
      value: "",
      expected: { data: {}, errors: { value: messages.required } },
    },
  ])("$name", ({ meta, mode, value, expected }) => {
    expect(run(password(meta), value, mode)).toEqual(expected);
  });
});

describe("coerceForm: kinds", () => {
  it("parses finite numbers with surrounding whitespace", () => {
    const f = field("n", { kind: "number" });
    expect(run(f, " 1.5 ").data).toEqual({ n: 1.5 });
    expect(run(f, "-3").data).toEqual({ n: -3 });
  });

  it("rejects non-numbers and non-finite values with invalidNumber", () => {
    const f = field("n", { kind: "number" });
    for (const raw of ["abc", "Infinity", "NaN", "   "]) {
      expect(run(f, raw).errors).toEqual({ n: messages.invalidNumber });
    }
  });

  it("rejects 1.5 on an integer field with invalidInteger", () => {
    const f = field("n", { kind: "number", isInteger: true });
    expect(run(f, "1.5").errors).toEqual({ n: messages.invalidInteger });
    expect(run(f, "2").data).toEqual({ n: 2 });
  });

  it("parses bigint and rejects non-integers with invalidInteger", () => {
    const f = field("n", { kind: "bigint" });
    expect(run(f, "9007199254740993").data).toEqual({ n: 9007199254740993n });
    expect(run(f, "-5").data).toEqual({ n: -5n });
    expect(run(f, "1.5").errors).toEqual({ n: messages.invalidInteger });
    expect(run(f, "abc").errors).toEqual({ n: messages.invalidInteger });
  });

  it("parses a datetime-local value in the given time zone", () => {
    const f = field("t", { kind: "date" });
    expect(run(f, "2026-10-07T09:30", "add", TOKYO).data).toEqual({
      t: new Date("2026-10-07T00:30:00.000Z"),
    });
    expect(run(f, "nope").errors).toEqual({ t: messages.invalidDate });
  });

  it("parses json and rejects invalid json", () => {
    const f = field("j", { kind: "json" });
    expect(run(f, '{"a":[1]}').data).toEqual({ j: { a: [1] } });
    expect(run(f, "{oops").errors).toEqual({ j: messages.invalidJson });
  });

  it("accepts enum members only", () => {
    const f = field("e", { kind: "enum", enumValues: ["a", "b"] });
    expect(run(f, "a").data).toEqual({ e: "a" });
    expect(run(f, "c").errors).toEqual({ e: messages.invalidChoice });
  });

  it("does not trim strings", () => {
    const f = field("s");
    expect(run(f, "  hi  ").data).toEqual({ s: "  hi  " });
  });

  it("coerces an FK field by its own kind", () => {
    const table = {} as never;
    const f = field(
      "authorId",
      { kind: "number", isInteger: true, foreignKey: { table, column: "id" } },
      "select",
    );
    expect(run(f, "7").data).toEqual({ authorId: 7 });
    expect(run(f, "x").errors).toEqual({ authorId: messages.invalidNumber });
  });
});

describe("coerceForm: date-only", () => {
  const dateField = field("d", { kind: "date", isDateOnly: true }, "date");

  it("yields UTC midnight whatever the time zone", () => {
    for (const tz of [TOKYO, "America/New_York"]) {
      expect(run(dateField, "2026-10-07", "add", tz).data).toEqual({
        d: new Date("2026-10-07T00:00:00.000Z"),
      });
    }
    expect(run(dateField, " 2026-10-07 ").data).toEqual({
      d: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(run(dateField, "2026-02-30").errors).toEqual({ d: messages.invalidDate });
  });

  it("keeps a date-only string as a trimmed string", () => {
    const f = field("d", { kind: "string", isDateOnly: true }, "date");
    for (const raw of ["2026-10-07", " 2026-10-07 "]) {
      const { data } = run(f, raw);
      expect(data.d).toBe("2026-10-07");
      expect(typeof data.d).toBe("string");
    }
  });

  it("rejects impossible dates and other formats with invalidDate", () => {
    const f = field("d", { kind: "string", isDateOnly: true }, "date");
    for (const raw of ["2026-02-30", "2026/10/07", "2026-10-7", "2026-10-07T00:00"]) {
      expect(run(f, raw).errors).toEqual({ d: messages.invalidDate });
    }
  });

  it("gives null for an empty value when nullable", () => {
    const f = field("d", { kind: "string", isDateOnly: true, notNull: false }, "date");
    expect(run(f, "").data).toEqual({ d: null });
  });
});

describe("coerceForm: body handling", () => {
  it("ignores body keys that are not editable fields", () => {
    const f = field("name");
    const { data } = coerceForm([f], { name: "x", id: "1", unknown: "y" }, "add", TOKYO);
    expect(data).toEqual({ name: "x" });
    expect("id" in data).toBe(false);
    expect("unknown" in data).toBe(false);
  });

  it("does not read a non-editable field", () => {
    const f = { ...field("name"), editable: false };
    expect(coerceForm([f], { name: "x" }, "change", TOKYO)).toEqual({ data: {}, errors: {} });
  });

  it("uses the last value of a multi-valued key", () => {
    expect(run(field("name"), ["a", "b"]).data).toEqual({ name: "b" });
  });

  it("counts a File as missing", () => {
    const file = new File(["x"], "x.txt");
    expect(run(field("name"), file).errors).toEqual({ name: messages.required });
    expect(run(field("name", { notNull: false }), file).data).toEqual({ name: null });
    expect(run(field("name"), ["a", file]).data).toEqual({ name: "a" });
  });

  it("does not let a text override change coercion", () => {
    const f = field("n", { kind: "number" }, "text");
    expect(run(f, "42").data).toEqual({ n: 42 });
  });
});

describe("rawValues", () => {
  it("returns submitted strings of editable fields only, with checkboxes as on/empty", () => {
    const fields = [field("name"), field("flag", { kind: "boolean" }, "checkbox"), field("miss")];
    const body: FormBody = { name: ["a", "b"], flag: "0", id: "1" };
    expect(rawValues(fields, body)).toEqual({ name: "b", flag: "", miss: "" });
    expect(rawValues(fields, { flag: "on" }).flag).toBe("on");
  });
});
