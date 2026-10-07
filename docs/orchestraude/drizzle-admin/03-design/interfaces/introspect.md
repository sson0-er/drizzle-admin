# Interface: introspect

Files: `src/introspect/index.ts` (dialect-independent mapping), `src/introspect/sqlite.ts`, `src/introspect/pg.ts` (`getTableConfig` adapters and table-type checks).
This is the only place that reads Drizzle `Column` properties. `any` is allowed here only with `// biome-ignore lint/suspicious/noExplicitAny: <reason>`.

## Responsibilities
- Convert a Drizzle table into `ModelMeta` for the configured dialect.
- Reject tables of the wrong dialect, tables with no primary key, and tables with a composite primary key.
- Provide a JSON-safe projection for snapshot tests.

## API
```ts
export type Dialect = "sqlite" | "postgres";
export function introspectTable(table: Table, dialect: Dialect): ModelMeta;
export function toSnapshot(meta: ModelMeta): unknown; // table objects replaced by table names
```
Adapter shape (one per dialect):
```ts
interface DialectAdapter {
  isTable(table: unknown): boolean;              // is(table, SQLiteTable) / is(table, PgTable)
  getConfig(table: Table): {
    primaryKeyColumns: Column[];                 // from config.primaryKeys[*].columns (table-level PKs)
    foreignKeys: { columns: Column[]; foreignTable: Table; foreignColumns: Column[] }[];
      // from config.foreignKeys[i].reference()
  };
}
```
Sources: `getTableColumns(table)` and `getTableName(table)` from `drizzle-orm`; `getTableConfig` from `drizzle-orm/sqlite-core` or `drizzle-orm/pg-core`.

## Data formats
```ts
interface FieldMeta {
  key: string;            // property name (key of getTableColumns)
  dbName: string;         // column.name
  kind: "string" | "number" | "bigint" | "boolean" | "date" | "json" | "enum" | "unknown";
  enumValues?: string[];  // only when kind === "enum"
  notNull: boolean;       // column.notNull
  hasDefault: boolean;    // column.hasDefault (true for .default(), $defaultFn, serial, identity, sqlite integer PK)
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isInteger: boolean;     // addition (decision 010)
  isLongText: boolean;    // addition
  isDateOnly: boolean;    // addition: calendar-date column; value is a UTC-midnight Date (kind date) or a "YYYY-MM-DD" string (kind string)
  isGenerated: boolean;   // addition
  foreignKey?: { table: Table; column: string; slug?: string };
}
interface ModelMeta { table: Table; tableName: string; pk: FieldMeta; fields: FieldMeta[] } // fields in definition order
```

### Mapping rules (decision 010)
Changed 2026-10-07: values of `isDateOnly` fields are UTC-midnight Dates (decision 019).
Changed 2026-10-07: `isDateOnly` also covers PG `date()` string mode, which keeps kind string (decision 023).
Changed 2026-10-07: SQLite `blob({mode:"bigint"})` is the SQLite bigint column and maps to kind bigint (decision 026).

| Input | Result |
|---|---|
| `dataType === "string"` and `Array.isArray(enumValues) && enumValues.length > 0` | kind `enum`, `enumValues` copied |
| `dataType` in string, number, bigint, boolean, date, json | kind = dataType |
| any other dataType (`buffer`, `array`, `custom`, ...) | kind `unknown` |
| `isInteger` | kind number and columnType in SQLiteInteger, PgInteger, PgSmallInt, PgBigInt53, PgSerial, PgSmallSerial, PgBigSerial53 |
| `isLongText` | kind string and columnType `PgText` |
| `isDateOnly` | columnType `PgDate` (kind date) or `PgDateString` (kind string). For PgDate, drizzle returns and expects UTC-midnight Dates; for PgDateString it passes `YYYY-MM-DD` strings through unchanged. Other components must not apply the time zone to either, and must branch on `kind` to know the value type (decisions 019, 023; evidence: 2026-10-07-drizzle-pg-date-mapping, 2026-10-07-pg-date-string-mode-filtering) |
| `isGenerated` | `column.generated` is defined |
| PK set | columns with `primary === true` ∪ `getConfig().primaryKeyColumns` (by identity) |
| `isAutoIncrement` | PK and (columnType `SQLiteInteger` **or** columnType in PgSerial, PgSmallSerial, PgBigSerial53, PgBigSerial64 **or** `column.generatedIdentity` defined) |
| `foreignKey` | for FKs with exactly one column: `{ table: foreignTable, column: <key of foreignColumns[0] in getTableColumns(foreignTable)> }`. Multi-column FKs are ignored. `slug` is filled at finalization (admin.md) |

Observed values (runtime, drizzle 0.45.3) that the snapshot tests must reproduce (evidence: 2026-10-07-drizzle-column-introspection, 2026-10-07-drizzle-column-variants, 2026-10-07-drizzle-driver-runtime-behavior):
- SQLite `integer({mode:"boolean"})` → boolean; `integer({mode:"timestamp"|"timestamp_ms"})` → date; `text({mode:"json"})` → json; `text({enum})` → enum; `integer().primaryKey({autoIncrement:true})` → number, hasDefault, autoIncrement; `blob({mode:"bigint"})` (columnType `SQLiteBigInt`) → bigint. SQLite `integer()` has no bigint mode, so this is the only SQLite bigint column; its values sort as BLOBs, not numerically (evidence: 2026-10-07-sqlite-blob-bigint-ordering; decision 026). Other `blob` modes (dataType buffer/json) follow the table above.
- PG `serial` → number, notNull, hasDefault, autoIncrement; `pgEnum` column → enum; `timestamp` → date; `jsonb` → json; `text` → string + isLongText; `varchar` → string; `bigint({mode:"bigint"})` → bigint; `uuid().defaultRandom()` → string, hasDefault, not autoIncrement; `date()` → string + isDateOnly (PgDateString); `date({mode:"date"})` → date + isDateOnly.

## Errors
Thrown as `Error("drizzle-admin: ...")`:
- Dialect mismatch: `table "<name>" is not a <SQLite|PostgreSQL> table but dialect is "<dialect>"`.
- No primary key: `table "<name>" has no primary key`.
- Composite primary key: `table "<name>" has a composite primary key (<keys>); composite keys are not supported`.
