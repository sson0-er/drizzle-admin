---
id: 2026-10-08-pg-key-input-domains
question: For decision 045, which PK/FK input values make PostgreSQL raise an error instead of matching no row, and how does drizzle name those column types?
source: https://www.postgresql.org/docs/current/datatype-numeric.html ; https://www.postgresql.org/docs/current/datatype-uuid.html ; drizzle-orm 0.45.3 local run of getTableColumns ; security-audit data.findings.json
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- smallint -32768..32767, integer -2147483648..2147483647, bigint -9223372036854775808..9223372036854775807; serial types share these ranges (positive part). Out-of-range input is an error (the audit saw SQLSTATE 22003 for `3000000000` against an int4 PK and FK filter).
- uuid input accepts canonical 8-4-4-4-12 hex (any case), braces, no hyphens or extra hyphens; output is always lowercase canonical. A non-uuid string errors (the audit saw 22P02).
- A NUL character in a text parameter errors on PG (the audit saw 22021 for `?q=%00`).
- drizzle columnType names: PgSmallInt, PgSmallSerial, PgInteger, PgSerial, PgBigInt53, PgBigSerial53, PgBigInt64, PgBigSerial64, PgUUID. `integer().generatedByDefaultAsIdentity()` has `generatedIdentity.type === "byDefault"`, `generated === undefined`, `hasDefault` true.
Not confirmed: PG input errors for other key types (numeric, date, inet) used as PK/FK; not checked because such keys are unusual.
