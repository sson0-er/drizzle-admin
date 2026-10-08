import { z } from "zod";
import { messages } from "../messages.js";
import type { FormField, FormMode } from "./fields.js";

function baseType(field: FormField): z.ZodType {
  const { meta } = field;
  switch (meta.kind) {
    case "number":
      return meta.isInteger ? z.number().int() : z.number();
    case "bigint":
      return z.bigint();
    case "boolean":
      return z.boolean();
    case "date":
      return z.date();
    case "json":
      return z.unknown();
    case "enum":
      return z.enum((meta.enumValues ?? []) as [string, ...string[]]);
    default:
      // Date-only strings included: coercion has already checked the format.
      return z.string();
  }
}

export function buildZodSchema(fields: FormField[], mode: FormMode): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    if (!field.editable) continue;
    const { meta } = field;
    let type = baseType(field);
    if (!meta.notNull) type = type.nullable();
    if (mode === "add" && meta.notNull && meta.hasDefault) type = type.optional();
    // Coercion omits an empty password on change (decision 037).
    if (mode === "change" && field.widget === "password") type = type.optional();
    shape[field.key] = type;
  }
  return z.object(shape);
}

/** Parses `data`; failures map to `messages.invalidValue`, first issue per field. */
export function parseWithSchema(
  schema: z.ZodObject<z.ZodRawShape>,
  data: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    // zod's own messages are never shown.
    if (typeof key === "string" && !(key in errors)) errors[key] = messages.invalidValue;
  }
  return { ok: false, errors };
}
