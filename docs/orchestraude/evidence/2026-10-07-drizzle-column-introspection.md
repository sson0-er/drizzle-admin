---
id: 2026-10-07-drizzle-column-introspection
question: What Column/getTableConfig properties does drizzle-orm 0.45.3 expose for introspection (sqlite and pg)?
source: Probe script run against drizzle-orm@0.45.3 on Node 24.21.0 (getTableColumns, sqlite-core/pg-core getTableConfig)
fetched: 2026-10-07
expires: 2026-11-06
---
Learned (runtime-confirmed): each column has name, dataType, columnType, notNull, hasDefault, primary, enumValues, and mode for some sqlite columns.
SQLite: integer pk autoIncrement -> number/SQLiteInteger, hasDefault true, primary true; integer({mode:'boolean'}) -> dataType boolean/SQLiteBoolean; integer({mode:'timestamp'|'timestamp_ms'}) -> dataType date/SQLiteTimestamp, mode distinguishes; text({mode:'json'}) -> json/SQLiteTextJson; text({enum}) -> string/SQLiteText with enumValues.
PG: serial -> number/PgSerial notNull+hasDefault+primary; pgEnum column -> string/PgEnumColumn with enumValues; timestamp -> date/PgTimestamp; jsonb -> json/PgJsonb; text/varchar -> string/PgText/PgVarchar (textarea decision must use columnType); bigint({mode:'bigint'}) -> bigint/PgBigInt64; uuid -> string/PgUUID; date() -> string/PgDateString (dataType string, not date); generatedAlwaysAsIdentity integer -> hasDefault true.
Composite PK: c.primary is false for members; table-level primaryKey() appears in getTableConfig(t).primaryKeys (length 1 in the probe). FKs: getTableConfig(t).foreignKeys[i].reference().foreignColumns gives referenced columns. pg getTableConfig keys: columns, indexes, foreignKeys, checks, primaryKeys, uniqueConstraints, name, schema, policies, enableRLS.
Unknown: other pg column types (numeric, interval, arrays, etc.) and sqlite blob/bigint modes not probed.
