import type { FieldMeta } from "../introspect/index.js";
import type { WidgetType } from "../types.js";

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
