// List cell formatting. Returned strings are plain text; escaping is left to Hono JSX.
import type { DbRow } from "../data/repository.js";
import type { FieldMeta } from "../introspect/index.js";
import { formatDate, formatDateTime } from "../time.js";

export const TRUNCATE_AT = 100;

function truncate(text: string): string {
  return text.length > TRUNCATE_AT ? `${text.slice(0, TRUNCATE_AT)}…` : text;
}

function stringify(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function jsonText(value: unknown): string {
  try {
    // JSON.stringify returns undefined for functions and symbols.
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// Rules 2 and 4-10 of the format order (views.md); rules 1 and 3 need caller-supplied inputs.
export function formatValue(field: FieldMeta, value: unknown, tz: string): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  // A date-only string is not a Date and falls through to the default rule unchanged (decision 023).
  if (value instanceof Date) {
    return field.isDateOnly ? formatDate(value) : formatDateTime(value, tz);
  }
  if (field.kind === "json") return truncate(jsonText(value));
  if (typeof value === "bigint" || typeof value === "number") return String(value);
  if (value instanceof Uint8Array) return "[binary]";
  return truncate(stringify(value));
}

// Glyph-only literal, not a message (decision 033 item 11).
const PASSWORD_MASK = "********";

interface CellArgs {
  field: FieldMeta;
  value: unknown;
  row: DbRow;
  tz: string;
  formatter?: (v: unknown, row: DbRow) => string;
  fkLabel?: string;
  /** Password-widget field: the value must never reach the HTML (decision 037). */
  masked?: boolean;
}

type Leading =
  | { rule: "masked" | "null" }
  | { rule: "formatter"; formatter: NonNullable<CellArgs["formatter"]> }
  | { rule: "fkLabel"; fkLabel: string };

/** The first of rules 0-3 that matches, without calling the formatter; `undefined` if none. */
function leadingRule({ value, formatter, fkLabel, masked }: CellArgs): Leading | undefined {
  if (masked) return { rule: "masked" };
  if (formatter) return { rule: "formatter", formatter };
  if (value === null || value === undefined) return { rule: "null" };
  if (fkLabel !== undefined) return { rule: "fkLabel", fkLabel };
  return undefined;
}

export function formatCell(args: CellArgs): string {
  const { field, value, row, tz } = args;
  const leading = leadingRule(args);
  switch (leading?.rule) {
    case "masked":
      return PASSWORD_MASK;
    case "formatter":
      return leading.formatter(value, row);
    case "null":
      return "-";
    case "fkLabel":
      return leading.fkLabel;
    case undefined:
      return formatValue(field, value, tz);
  }
}

/**
 * The value itself when rule 4 of `formatCell` (boolean) is the first rule that matches, so the
 * list can draw a mark instead of the glyph (decision 039); `undefined` otherwise.
 */
export function cellBoolean(args: CellArgs): boolean | undefined {
  return leadingRule(args) === undefined && typeof args.value === "boolean"
    ? args.value
    : undefined;
}
