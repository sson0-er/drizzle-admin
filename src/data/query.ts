// Pure SQL condition builders. User input is always a bound parameter, never spliced into SQL text.
import { and, asc, type Column, desc, eq, gte, ilike, lt, or, type SQL, sql } from "drizzle-orm";
import type { Dialect, FieldMeta, ModelMeta } from "../introspect/index.js";
import { calendarPresetRange, type DatePreset, datePresetRange, toDateOnly } from "../time.js";

export type OrderItem = { key: string; desc: boolean };

const PRESETS: readonly string[] = ["today", "past7", "month", "year"];

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Keys are whitelisted by the caller, so a missing column is a programming error.
function columnOf(meta: ModelMeta, key: string): Column {
  const col = (meta.table as unknown as Record<string, Column | undefined>)[key];
  if (!col) throw new Error(`drizzle-admin: unknown column "${key}" on "${meta.tableName}"`);
  return col;
}

export function buildSearch(
  meta: ModelMeta,
  searchFields: string[],
  q: string | undefined,
  dialect: Dialect,
): SQL | undefined {
  const term = q?.trim();
  if (!term || searchFields.length === 0) return undefined;
  const pattern = `%${escapeLike(term)}%`;
  // The cast is needed on PG because uuid, numeric, date and enum columns have no ilike operator
  // (decision 018). SQLite has no default LIKE escape character, so ESCAPE is spelled out and
  // drizzle's like() (which emits none) is not used (decision 009).
  const conditions = searchFields.map((key) => {
    const col = columnOf(meta, key);
    return dialect === "postgres"
      ? ilike(sql`${col}::text`, pattern)
      : sql`${col} like ${pattern} escape '\\'`;
  });
  return or(...conditions);
}

function dateRange(
  field: FieldMeta,
  preset: DatePreset,
  timeZone: string,
  now: Date,
): { start: Date | string; end: Date | string } {
  if (!field.isDateOnly) return datePresetRange(preset, now, timeZone);
  const { start, end } = calendarPresetRange(preset, now, timeZone);
  // Date-only strings (PG date() string mode) are compared as YYYY-MM-DD strings (decision 023).
  return field.kind === "string"
    ? { start: toDateOnly(start), end: toDateOnly(end) }
    : { start, end };
}

export function buildFilters(
  meta: ModelMeta,
  filters: Record<string, string>,
  timeZone: string,
  now: Date,
): SQL[] {
  const out: SQL[] = [];
  for (const [key, value] of Object.entries(filters)) {
    const field = meta.fields.find((f) => f.key === key);
    if (!field) continue;
    const col = columnOf(meta, key);
    if (field.kind === "date" || field.isDateOnly) {
      // Checked before the FK branch: a date-kind FK filters by presets.
      if (!PRESETS.includes(value)) continue;
      const { start, end } = dateRange(field, value as DatePreset, timeZone, now);
      const cond = and(gte(col, start), lt(col, end));
      if (cond) out.push(cond);
    } else if (field.kind === "boolean") {
      if (value === "1") out.push(eq(col, true));
      else if (value === "0") out.push(eq(col, false));
    } else if (field.kind === "enum") {
      if (field.enumValues?.includes(value)) out.push(eq(col, value));
    } else if (field.foreignKey) {
      const parsed = parseFieldValue(field, value);
      if (parsed !== null) out.push(eq(col, parsed));
    }
  }
  return out;
}

export function buildOrderBy(meta: ModelMeta, ordering: OrderItem[]): SQL[] {
  const out = ordering.map((item) => {
    const col = columnOf(meta, item.key);
    return item.desc ? desc(col) : asc(col);
  });
  if (!ordering.some((item) => item.key === meta.pk.key))
    out.push(asc(columnOf(meta, meta.pk.key)));
  return out;
}

const INT_RANGES = {
  int16: [-32768, 32767],
  int32: [-2147483648, 2147483647],
} as const;
const INT64_MIN = -9223372036854775808n;
const INT64_MAX = 9223372036854775807n;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns null for anything the DB would reject, so callers never send it as a parameter.
export function parseFieldValue(field: FieldMeta, raw: string): string | number | bigint | null {
  switch (field.kind) {
    case "number": {
      if (field.isInteger) {
        if (!/^-?\d+$/.test(raw)) return null;
        const n = Number(raw);
        if (!Number.isSafeInteger(n)) return null;
        const range =
          field.valueCheck === "int16" || field.valueCheck === "int32"
            ? INT_RANGES[field.valueCheck]
            : undefined;
        return range === undefined || (n >= range[0] && n <= range[1]) ? n : null;
      }
      if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "bigint": {
      if (!/^-?\d+$/.test(raw)) return null;
      const n = BigInt(raw);
      return field.valueCheck === "int64" && (n < INT64_MIN || n > INT64_MAX) ? null : n;
    }
    case "string":
      if (raw.includes("\u0000")) return null;
      return field.valueCheck === "uuid" && !UUID.test(raw) ? null : raw;
    case "enum":
      return field.enumValues?.includes(raw) ? raw : null;
    default:
      return null;
  }
}

export function parsePk(field: FieldMeta, raw: string): string | number | bigint | null {
  return parseFieldValue(field, raw);
}
