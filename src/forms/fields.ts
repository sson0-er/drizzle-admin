import type { FieldMeta } from "../introspect/index.js";
import type { ResolvedModel, WidgetType } from "../types.js";

const NONE: readonly WidgetType[] = [];

/**
 * Widgets that `options.widgets` may override for a field (decision 021). The first matching
 * row wins, so the order of the branches matters (e.g. foreignKey before kind).
 */
export function allowedWidgets(meta: FieldMeta): readonly WidgetType[] {
  if (meta.foreignKey !== undefined) {
    const input = meta.kind === "number" || meta.kind === "bigint" ? "number" : "text";
    return ["select", input, "hidden"];
  }
  switch (meta.kind) {
    case "enum":
      return ["select", "text", "hidden"];
    case "boolean":
      return ["checkbox"];
    case "string":
      // PG `date()` string mode is a calendar date, so no free-text widgets (decision 023).
      return meta.isDateOnly
        ? ["date", "text", "hidden"]
        : ["text", "textarea", "password", "hidden"];
    case "number":
    case "bigint":
      return ["number", "text", "hidden"];
    case "date":
      return meta.isDateOnly ? ["date", "text", "hidden"] : ["datetime", "text", "hidden"];
    case "json":
      return ["json", "textarea"];
    default:
      return NONE;
  }
}

export type FormMode = "add" | "change";
export type Choice = { value: string; label: string };

export interface FormField {
  key: string;
  /** No verbose names in v1, so the label is the key. */
  label: string;
  meta: FieldMeta;
  widget: WidgetType;
  /** False means rendered display-only and never read from the request body. */
  editable: boolean;
  /** For the UI marker only; the server decides through coercion. */
  required: boolean;
  /** Select widgets only; starts with the empty choice when the field is nullable. */
  choices?: Choice[];
  /** FK with too many choices: link to the referenced list page. */
  fkFallbackHref?: string;
}

export interface FormGroup {
  title?: string;
  fields: FormField[];
}

export const EMPTY_CHOICE: Choice = { value: "", label: "---------" };

type Editability = "omitted" | "display" | "editable";

function editabilityOf(
  meta: FieldMeta,
  model: ResolvedModel,
  mode: FormMode,
  canChange: boolean,
): Editability {
  const locked = model.readonlyFields.has(meta.key) || meta.isGenerated || meta.kind === "unknown";
  if (mode === "add") {
    return locked || meta.isAutoIncrement ? "omitted" : "editable";
  }
  // A primary key is never renamed on the change page (decision 013 item 2).
  return locked || meta.isPrimaryKey || !canChange ? "display" : "editable";
}

function defaultWidget(meta: FieldMeta): WidgetType {
  switch (meta.kind) {
    case "enum":
      return "select";
    case "boolean":
      return "checkbox";
    case "date":
      return meta.isDateOnly ? "date" : "datetime";
    case "string":
      if (meta.isDateOnly) return "date";
      return meta.isLongText ? "textarea" : "text";
    case "json":
      return "json";
    case "number":
    case "bigint":
      return "number";
    default:
      return "text";
  }
}

function withEmptyChoice(meta: FieldMeta, choices: readonly Choice[]): Choice[] {
  return meta.notNull ? [...choices] : [EMPTY_CHOICE, ...choices];
}

export function buildFormGroups(args: {
  model: ResolvedModel;
  mode: FormMode;
  canChange: boolean;
  prefix: string;
  /** Keyed by field key; only FK fields whose referenced model is registered. */
  fkChoices: ReadonlyMap<string, Choice[] | "tooMany">;
  refSlugOf: (key: string) => string | undefined;
}): FormGroup[] {
  const { model, mode, canChange, prefix, fkChoices, refSlugOf } = args;
  const byKey = new Map(model.meta.fields.map((f) => [f.key, f]));
  const groups: FormGroup[] = [];

  for (const fieldset of model.fieldsets) {
    const fields: FormField[] = [];
    for (const key of fieldset.fields) {
      const meta = byKey.get(key);
      if (meta === undefined) continue;
      const editability = editabilityOf(meta, model, mode, canChange);
      if (editability === "omitted") continue;

      const fk = meta.foreignKey;
      const fkChoice = fk?.slug === undefined ? undefined : (fkChoices.get(key) ?? []);
      const override = model.widgets[key];
      let widget = override ?? defaultWidget(meta);
      let choices: Choice[] | undefined;
      let fkFallbackHref: string | undefined;

      if (fk !== undefined && fk.slug !== undefined && fkChoice !== undefined) {
        // Only a `select` (default or override) is replaced by the plain input; other overrides stay.
        if (fkChoice === "tooMany") {
          if (override === undefined || override === "select") {
            widget = meta.kind === "number" || meta.kind === "bigint" ? "number" : "text";
          }
          fkFallbackHref = `${prefix}/${refSlugOf(key) ?? fk.slug}/`;
        } else if (override === undefined) {
          widget = "select";
        }
        if (widget === "select" && fkChoice !== "tooMany") {
          choices = withEmptyChoice(meta, fkChoice);
        }
      } else if (widget === "select" && meta.kind === "enum") {
        choices = withEmptyChoice(
          meta,
          (meta.enumValues ?? []).map((value) => ({ value, label: value })),
        );
      }

      fields.push({
        key,
        label: key,
        meta,
        widget,
        editable: editability === "editable",
        required: meta.notNull && !(mode === "add" && meta.hasDefault),
        ...(choices === undefined ? {} : { choices }),
        ...(fkFallbackHref === undefined ? {} : { fkFallbackHref }),
      });
    }
    if (fields.length > 0) {
      groups.push({ ...(fieldset.title === undefined ? {} : { title: fieldset.title }), fields });
    }
  }
  return groups;
}

export function editableFields(groups: FormGroup[]): FormField[] {
  return groups.flatMap((group) => group.fields.filter((field) => field.editable));
}
