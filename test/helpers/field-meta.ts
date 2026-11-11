import type { FieldMeta } from "../../src/introspect/index.js";

/** A nullable string column named `f` with every flag off; a test overrides what it exercises. */
export function fieldMeta(over: Partial<FieldMeta> = {}): FieldMeta {
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
    ...over,
  };
}
