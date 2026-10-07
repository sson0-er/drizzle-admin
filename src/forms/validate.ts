import type { ResolvedModel } from "../types.js";
import { coerceForm, type FormBody, rawValues } from "./coerce.js";
import type { FormField, FormMode } from "./fields.js";
import { buildZodSchema, parseWithSchema } from "./schema.js";

export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | {
      ok: false;
      fieldErrors: Record<string, string>;
      formErrors: string[];
      values: Record<string, string>;
    };

export async function validateSubmission(args: {
  model: ResolvedModel;
  fields: FormField[];
  body: FormBody;
  mode: FormMode;
  timeZone: string;
}): Promise<ValidationResult> {
  const { model, fields, body, mode, timeZone } = args;
  const fail = (fieldErrors: Record<string, string>, formErrors: string[] = []) => ({
    ok: false as const,
    fieldErrors,
    formErrors,
    values: rawValues(fields, body),
  });

  const coerced = coerceForm(fields, body, mode, timeZone);
  if (Object.keys(coerced.errors).length > 0) return fail(coerced.errors);

  const parsed = parseWithSchema(buildZodSchema(fields, mode), coerced.data);
  if (!parsed.ok) return fail(parsed.errors);

  // A throwing `validate` is a programming error and is deliberately not caught (-> 500).
  const returned = await model.validate?.(parsed.data, { mode });
  if (returned && Object.keys(returned).length > 0) {
    const editable = new Set(fields.filter((f) => f.editable).map((f) => f.key));
    const fieldErrors: Record<string, string> = {};
    const formErrors: string[] = [];
    for (const [key, message] of Object.entries(returned)) {
      if (editable.has(key)) fieldErrors[key] = message;
      else formErrors.push(message);
    }
    return fail(fieldErrors, formErrors);
  }
  return { ok: true, data: parsed.data };
}
