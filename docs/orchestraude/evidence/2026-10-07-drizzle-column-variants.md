---
id: 2026-10-07-drizzle-column-variants
question: What dataType/columnType do further drizzle 0.45.3 column variants report (for kind mapping, integer and generated detection)?
source: scratch probe with getTableColumns on drizzle-orm 0.45.3 pg-core and sqlite-core
fetched: 2026-10-07
expires: 2026-11-06
---
Learned (dataType/columnType): PG smallint number/PgSmallInt, integer number/PgInteger, bigint({mode:number}) number/PgBigInt53, bigserial({mode:number}) number/PgBigSerial53 (hasDefault), smallserial number/PgSmallSerial (hasDefault), real number/PgReal, doublePrecision number/PgDoublePrecision, numeric string/PgNumeric, varchar string/PgVarchar, date() string/PgDateString, date({mode:date}) date/PgDate, timestamp({mode:string}) string/PgTimestampString, timestamp({withTimezone}) date/PgTimestamp, json json/PgJson, boolean boolean/PgBoolean, interval string/PgInterval, text().array() array/PgArray.
Identity: `integer().generatedAlwaysAsIdentity()` has hasDefault true and `generatedIdentity.type` "always". Generated: `generatedAlwaysAs(...)` columns expose `generated.type` "always" (pg and sqlite). `$defaultFn` sets hasDefault true. Plain text columns have enumValues undefined.
SQLite: real number/SQLiteReal, numeric string/SQLiteNumeric, blob buffer/SQLiteBlobBuffer, blob({mode:bigint}) bigint/SQLiteBigInt, integer({mode:number}) number/SQLiteInteger.
Unknown: other column types (PG cidr, point, vector, custom types).
