// The only module that reads Drizzle `Column` properties (decision 010). Everything downstream
// works on the FieldMeta / ModelMeta shapes defined here.
import { type Column, getTableColumns, getTableName, type Table } from "drizzle-orm";
import { pgAdapter } from "./pg.js";
import { sqliteAdapter } from "./sqlite.js";

export type Dialect = "sqlite" | "postgres";

export interface FieldMeta {
  key: string;
  dbName: string;
  kind: "string" | "number" | "bigint" | "boolean" | "date" | "json" | "enum" | "unknown";
  enumValues?: string[];
  notNull: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isInteger: boolean;
  isLongText: boolean;
  /** Calendar-date column: UTC-midnight Date (kind date) or "YYYY-MM-DD" string (kind string). */
  isDateOnly: boolean;
  isGenerated: boolean;
  foreignKey?: { table: Table; column: string; slug?: string };
}

export interface ModelMeta {
  table: Table;
  tableName: string;
  pk: FieldMeta;
  fields: FieldMeta[];
}

export interface DialectAdapter {
  /** Human-readable dialect name used in error messages. */
  label: string;
  isTable(table: unknown): boolean;
  getConfig(table: Table): {
    primaryKeyColumns: Column[];
    foreignKeys: { columns: Column[]; foreignTable: Table; foreignColumns: Column[] }[];
  };
}

const ADAPTERS: Record<Dialect, DialectAdapter> = {
  sqlite: sqliteAdapter,
  postgres: pgAdapter,
};

const INTEGER_TYPES = new Set([
  "SQLiteInteger",
  "PgInteger",
  "PgSmallInt",
  "PgBigInt53",
  "PgSerial",
  "PgSmallSerial",
  "PgBigSerial53",
]);
const PG_SERIAL_TYPES = new Set(["PgSerial", "PgSmallSerial", "PgBigSerial53", "PgBigSerial64"]);
const PLAIN_KINDS = new Set(["string", "number", "bigint", "boolean", "date", "json"]);

function kindOf(column: Column): Pick<FieldMeta, "kind" | "enumValues"> {
  const { dataType, enumValues } = column;
  if (dataType === "string" && Array.isArray(enumValues) && enumValues.length > 0) {
    return { kind: "enum", enumValues: [...(enumValues as string[])] };
  }
  if (PLAIN_KINDS.has(dataType)) return { kind: dataType as FieldMeta["kind"] };
  return { kind: "unknown" };
}

function keyOf(columns: Record<string, Column>, column: Column | undefined): string | undefined {
  if (column === undefined) return undefined;
  return Object.keys(columns).find((key) => columns[key] === column);
}

export function introspectTable(table: Table, dialect: Dialect): ModelMeta {
  const adapter = ADAPTERS[dialect];
  const tableName = getTableName(table);
  if (!adapter.isTable(table)) {
    throw new Error(
      `drizzle-admin: table "${tableName}" is not a ${adapter.label} table but dialect is "${dialect}"`,
    );
  }

  const columns = getTableColumns(table);
  const config = adapter.getConfig(table);

  const pkColumns = new Set<Column>(config.primaryKeyColumns);
  for (const column of Object.values(columns)) {
    if (column.primary) pkColumns.add(column);
  }
  if (pkColumns.size === 0) {
    throw new Error(`drizzle-admin: table "${tableName}" has no primary key`);
  }
  if (pkColumns.size > 1) {
    const keys = [...pkColumns].map((c) => keyOf(columns, c) ?? c.name).join(", ");
    throw new Error(
      `drizzle-admin: table "${tableName}" has a composite primary key (${keys}); composite keys are not supported`,
    );
  }

  // Only single-column FKs are supported; multi-column ones are ignored.
  const foreignKeys = new Map<Column, NonNullable<FieldMeta["foreignKey"]>>();
  for (const fk of config.foreignKeys) {
    const [local] = fk.columns;
    const [remote] = fk.foreignColumns;
    if (fk.columns.length !== 1 || local === undefined || remote === undefined) continue;
    const remoteKey = keyOf(getTableColumns(fk.foreignTable), remote);
    if (remoteKey === undefined) continue;
    foreignKeys.set(local, { table: fk.foreignTable, column: remoteKey });
  }

  const fields = Object.entries(columns).map(([key, column]): FieldMeta => {
    const { kind, enumValues } = kindOf(column);
    const isPrimaryKey = pkColumns.has(column);
    const columnType = column.columnType as string;
    const field: FieldMeta = {
      key,
      dbName: column.name,
      kind,
      notNull: column.notNull,
      hasDefault: column.hasDefault,
      isPrimaryKey,
      isAutoIncrement:
        isPrimaryKey &&
        (columnType === "SQLiteInteger" ||
          PG_SERIAL_TYPES.has(columnType) ||
          column.generatedIdentity !== undefined),
      isInteger: kind === "number" && INTEGER_TYPES.has(columnType),
      isLongText: kind === "string" && columnType === "PgText",
      isDateOnly: columnType === "PgDate" || columnType === "PgDateString",
      isGenerated: column.generated !== undefined,
    };
    if (enumValues !== undefined) field.enumValues = enumValues;
    const foreignKey = foreignKeys.get(column);
    if (foreignKey !== undefined) field.foreignKey = foreignKey;
    return field;
  });

  const pk = fields.find((f) => f.isPrimaryKey);
  if (pk === undefined) throw new Error(`drizzle-admin: table "${tableName}" has no primary key`);
  return { table, tableName, pk, fields };
}

function snapshotField(field: FieldMeta): unknown {
  const { foreignKey, ...rest } = field;
  if (foreignKey === undefined) return rest;
  return { ...rest, foreignKey: { ...foreignKey, table: getTableName(foreignKey.table) } };
}

/** JSON-safe projection: table objects are replaced by table names. */
export function toSnapshot(meta: ModelMeta): unknown {
  return {
    table: meta.tableName,
    tableName: meta.tableName,
    pk: snapshotField(meta.pk),
    fields: meta.fields.map(snapshotField),
  };
}
