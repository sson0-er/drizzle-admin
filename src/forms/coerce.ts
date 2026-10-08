import { messages } from "../messages.js";
import { parseDateOnly, parseDatetimeLocal } from "../time.js";
import type { FormBody } from "../types.js";
import type { FormField, FormMode } from "./fields.js";

export type { FormBody };

const INTEGER = /^-?\d+$/;

// Multi-valued keys use the last string. A `File` (or a missing key) counts as missing.
function lastString(body: FormBody, key: string): string | undefined {
  const raw = body[key];
  if (raw === undefined) return undefined;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    for (let i = raw.length - 1; i >= 0; i--) {
      const v = raw[i];
      if (typeof v === "string") return v;
    }
  }
  return undefined;
}

// An unchecked checkbox is not submitted at all, so absence means false.
function isChecked(raw: string | undefined): boolean {
  return raw !== undefined && raw !== "0" && raw !== "false";
}

type Parsed = { value: unknown } | { error: string };

function parseByKind(field: FormField, raw: string, timeZone: string): Parsed {
  const { meta } = field;
  switch (meta.kind) {
    case "number": {
      const trimmed = raw.trim();
      // Number("") is 0, so a whitespace-only input must be rejected explicitly.
      const n = trimmed === "" ? Number.NaN : Number(trimmed);
      if (!Number.isFinite(n)) return { error: messages.invalidNumber };
      if (meta.isInteger && !Number.isInteger(n)) return { error: messages.invalidInteger };
      return { value: n };
    }
    case "bigint": {
      const trimmed = raw.trim();
      return INTEGER.test(trimmed)
        ? { value: BigInt(trimmed) }
        : { error: messages.invalidInteger };
    }
    case "date": {
      // Date-only columns are UTC calendar dates; applying the time zone would shift the stored day.
      const date = meta.isDateOnly
        ? parseDateOnly(raw.trim())
        : parseDatetimeLocal(raw.trim(), timeZone);
      return date === null ? { error: messages.invalidDate } : { value: date };
    }
    case "json":
      try {
        return { value: JSON.parse(raw) };
      } catch {
        return { error: messages.invalidJson };
      }
    case "enum":
      return meta.enumValues?.includes(raw) ? { value: raw } : { error: messages.invalidChoice };
    case "string": {
      if (!meta.isDateOnly) return { value: raw };
      // PG would only reject impossible dates with a generic DB error and accept other formats.
      const v = raw.trim();
      return parseDateOnly(v) === null ? { error: messages.invalidDate } : { value: v };
    }
    default:
      return { value: raw };
  }
}

export function coerceForm(
  fields: FormField[],
  body: FormBody,
  mode: FormMode,
  timeZone: string,
): { data: Record<string, unknown>; errors: Record<string, string> } {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  // Only editable fields are read; every other body key is ignored (mass-assignment protection).
  for (const field of fields) {
    if (!field.editable) continue;
    const { key, meta } = field;
    const raw = lastString(body, key);
    if (meta.kind === "boolean") {
      data[key] = isChecked(raw);
      continue;
    }
    if (raw === undefined || raw === "") {
      // The one place where data handling depends on the widget (decision 037): the password input
      // is never pre-filled, so an empty change submission must keep the stored value.
      if (field.widget === "password" && mode === "change") continue;
      if (!meta.notNull) data[key] = null;
      else if (!(meta.hasDefault && mode === "add")) errors[key] = messages.required;
      continue;
    }
    const parsed = parseByKind(field, raw, timeZone);
    if ("error" in parsed) errors[key] = parsed.error;
    else data[key] = parsed.value;
  }
  return { data, errors };
}

/** Submitted strings of the editable fields, for re-rendering a failed form. */
export function rawValues(fields: FormField[], body: FormBody): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    if (!field.editable) continue;
    const raw = lastString(body, field.key);
    out[field.key] = field.meta.kind === "boolean" ? (isChecked(raw) ? "on" : "") : (raw ?? "");
  }
  return out;
}
