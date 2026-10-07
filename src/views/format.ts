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

export function formatCell(args: {
  field: FieldMeta;
  value: unknown;
  row: DbRow;
  tz: string;
  formatter?: (v: unknown, row: DbRow) => string;
  fkLabel?: string;
}): string {
  const { field, value, row, tz, formatter, fkLabel } = args;
  if (formatter) return formatter(value, row);
  if (value === null || value === undefined) return "-";
  if (fkLabel !== undefined) return fkLabel;
  return formatValue(field, value, tz);
}
