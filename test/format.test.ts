import { describe, expect, it, vi } from "vitest";
import type { FieldMeta } from "../src/introspect/index.js";
import { MESSAGES } from "../src/messages.js";
import { cellBoolean, formatCell, formatValue, TRUNCATE_AT } from "../src/views/format.js";

const TOKYO = "Asia/Tokyo";
const NY = "America/New_York";

function field(overrides: Partial<FieldMeta> = {}): FieldMeta {
  return {
    key: "f",
    dbName: "f",
    kind: "string",
    notNull: false,
    hasDefault: false,
    isPrimaryKey: false,
    isAutoIncrement: false,
    isInteger: false,
    isLongText: false,
    isDateOnly: false,
    isGenerated: false,
    ...overrides,
  };
}

const cell = (args: Partial<Parameters<typeof formatCell>[0]> & { value: unknown }) =>
  formatCell({ field: field(), row: {}, tz: TOKYO, t: MESSAGES.en, ...args });

describe("formatCell masked", () => {
  it.each([
    { name: "a string value", args: { value: "s3cret" } },
    { name: "null", args: { value: null } },
    { name: "a formatter", args: { value: "s3cret", formatter: () => "custom" } },
    { name: "an fkLabel", args: { value: 42, fkLabel: "Alice" } },
  ])("shows the mask for $name", ({ args }) => {
    expect(cell({ ...args, masked: true })).toBe("********");
  });
});

describe("formatCell rule order", () => {
  it("1: returns the formatter output as is, even for null and markup", () => {
    expect(cell({ value: "x", formatter: () => "<b>bold</b>" })).toBe("<b>bold</b>");
    expect(cell({ value: null, formatter: () => "custom" })).toBe("custom");
  });

  it("1: passes the value and the row to the formatter", () => {
    const row = { id: 1 };
    expect(cell({ value: 7, row, formatter: (v, r) => `${v}:${JSON.stringify(r)}` })).toBe(
      '7:{"id":1}',
    );
  });

  it("2: null and undefined become a dash", () => {
    expect(cell({ value: null })).toBe("-");
    expect(cell({ value: undefined })).toBe("-");
    expect(cell({ value: null, fkLabel: "label" })).toBe("-");
  });

  it("3: a numeric FK value with fkLabel shows the label", () => {
    const fk = field({ kind: "number", isInteger: true });
    expect(cell({ field: fk, value: 42, fkLabel: "Alice" })).toBe("Alice");
  });

  it("4: booleans become check and cross marks", () => {
    expect(cell({ value: true })).toBe("✓");
    expect(cell({ value: false })).toBe("✗");
  });

  it("5: a date-only Date shows the UTC calendar date under any time zone", () => {
    const f = field({ kind: "date", isDateOnly: true });
    const value = new Date("2026-10-07T00:00:00.000Z");
    expect(cell({ field: f, value, tz: TOKYO })).toBe("2026/10/07");
    expect(cell({ field: f, value, tz: NY })).toBe("2026/10/07");
  });

  it("6: a timestamp uses formatDateTime in the given zone", () => {
    const f = field({ kind: "date" });
    const value = new Date("2026-10-07T00:00:00.000Z");
    expect(cell({ field: f, value, tz: TOKYO })).toBe("2026/10/07 09:00");
    expect(cell({ field: f, value, tz: NY })).toBe("2026/10/06 20:00");
  });

  it("7: json values use JSON.stringify", () => {
    const f = field({ kind: "json" });
    expect(cell({ field: f, value: { a: [1, "x"] } })).toBe('{"a":[1,"x"]}');
    expect(cell({ field: f, value: "text" })).toBe('"text"');
  });

  it("8: numbers and bigints use String", () => {
    expect(cell({ value: 1.5 })).toBe("1.5");
    expect(cell({ value: 9007199254740993n })).toBe("9007199254740993");
  });

  it("9: binary values show a placeholder", () => {
    expect(cell({ value: new Uint8Array([1, 2]) })).toBe("[binary]");
    expect(cell({ value: Buffer.from("ab") })).toBe("[binary]");
  });

  it("9: the binary placeholder comes from the given dictionary", () => {
    expect(cell({ value: new Uint8Array([1, 2]), t: MESSAGES.ja })).toBe(MESSAGES.ja.binary);
    expect(MESSAGES.ja.binary).toBe("[バイナリ]");
  });

  it("10: a date-only string is shown as stored", () => {
    const f = field({ kind: "string", isDateOnly: true });
    expect(cell({ field: f, value: "2026-10-07" })).toBe("2026-10-07");
  });

  it("10: other values use String", () => {
    expect(cell({ value: "<i>x</i>" })).toBe("<i>x</i>");
    expect(cell({ value: Symbol("s") })).toBe("Symbol(s)");
  });
});

describe("truncation", () => {
  it("cuts a 101-char string to 100 chars plus an ellipsis", () => {
    const out = formatValue(field(), "a".repeat(TRUNCATE_AT + 1), TOKYO, MESSAGES.en);
    expect(out).toBe(`${"a".repeat(TRUNCATE_AT)}…`);
    expect(out).toHaveLength(TRUNCATE_AT + 1);
  });

  it("cuts a json value whose serialization exceeds 100 chars", () => {
    const value = { text: "d".repeat(TRUNCATE_AT) };
    const json = JSON.stringify(value);
    expect(json.length).toBeGreaterThan(TRUNCATE_AT);
    expect(formatValue(field({ kind: "json" }), value, TOKYO, MESSAGES.en)).toBe(
      `${json.slice(0, TRUNCATE_AT)}…`,
    );
  });

  it("keeps a 100-char string intact", () => {
    const text = "b".repeat(TRUNCATE_AT);
    expect(formatValue(field(), text, TOKYO, MESSAGES.en)).toBe(text);
  });

  it("does not truncate formatter output", () => {
    const long = "c".repeat(300);
    expect(cell({ value: "x", formatter: () => long })).toBe(long);
  });
});

describe("formatValue", () => {
  it("applies rules 2 and 4-10", () => {
    expect(formatValue(field(), null, TOKYO, MESSAGES.en)).toBe("-");
    expect(formatValue(field(), true, TOKYO, MESSAGES.en)).toBe("✓");
    expect(formatValue(field({ kind: "json" }), [1], TOKYO, MESSAGES.en)).toBe("[1]");
    expect(formatValue(field(), 3, TOKYO, MESSAGES.en)).toBe("3");
  });
});

describe("cellBoolean", () => {
  const bool = (args: Partial<Parameters<typeof formatCell>[0]> & { value: unknown }) =>
    cellBoolean({ field: field(), row: {}, tz: TOKYO, t: MESSAGES.en, ...args });

  it.each([
    { name: "true", value: true },
    { name: "false", value: false },
  ])("returns the boolean for $name", ({ value }) => {
    expect(bool({ value })).toBe(value);
  });

  it.each([
    { name: "masked", args: { value: true, masked: true } },
    { name: "a formatter", args: { value: true, formatter: () => "on" } },
    { name: "an fkLabel", args: { value: true, fkLabel: "Alice" } },
    { name: "null", args: { value: null } },
    { name: "undefined", args: { value: undefined } },
    { name: "the number 1", args: { value: 1 } },
    { name: 'the string "true"', args: { value: "true" } },
  ])("returns undefined for $name", ({ args }) => {
    expect(bool(args)).toBeUndefined();
  });
});

describe("formatter calls", () => {
  it("cellBoolean never calls the formatter", () => {
    const formatter = vi.fn(() => "x");
    expect(
      cellBoolean({ field: field(), row: {}, tz: TOKYO, t: MESSAGES.en, value: true, formatter }),
    ).toBeUndefined();
    expect(formatter).not.toHaveBeenCalled();
  });

  it("formatCell calls the formatter exactly once", () => {
    const formatter = vi.fn(() => "x");
    expect(cell({ value: true, formatter })).toBe("x");
    expect(formatter).toHaveBeenCalledTimes(1);
  });
});
