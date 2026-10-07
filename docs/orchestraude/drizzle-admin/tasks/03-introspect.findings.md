# Review findings

high: 0, medium: 0, low: 8

## high


## medium


## low

- [quality] Unreachable no-primary-key throw
  - location: src/introspect/index.ts:147
  - detail: pkColumns.size === 1 is guaranteed by the earlier checks, so fields.find(isPrimaryKey) always succeeds and the second 'has no primary key' throw is dead code. Use a non-null assertion or look the pk up from pkColumns directly.
  - evidence: (none)
- [quality] Duplicated sqlite/pg adapter getConfig bodies
  - location: src/introspect/sqlite.ts:7
  - detail: The sqlite and pg getConfig implementations are identical apart from the getTableConfig import and cast. A shared helper that maps a config object to the common shape would remove the duplication.
  - evidence: (none)
- [quality] toSnapshot emits redundant table field
  - location: src/introspect/index.ts:155
  - detail: 'table' and 'tableName' both hold meta.tableName in the snapshot; one is redundant.
  - evidence: (none)
- [spec] DialectAdapter gains an exported `label` member not in the design
  - location: src/introspect/index.ts:33
  - detail: introspect.md defines DialectAdapter as { isTable, getConfig } and lists only Dialect, introspectTable and toSnapshot (plus the two data shapes) as the public API. The implementation adds `label: string` to build the dialect-mismatch message, and exports the interface. This has no behavioral effect and the error text matches the design. Either record the extra member in the design or derive the label from `dialect` inside introspectTable (e.g. a const map) and keep the interface unexported.
  - evidence: (none)
- [spec] design ambiguity: SQLite `articles.big` is blob({mode:"bigint"})
  - location: test/fixtures/schema-sqlite.ts:26
  - detail: test-strategy.md asks for `big bigint` in both schemas. SQLite drizzle has no integer bigint mode, so the implementer used blob({mode:"bigint"}) (dataType bigint, kind bigint). That is a reasonable reading, but it fixes a BLOB storage type that later tasks build on: the 08 DDL, sorting and filtering on `big`, and the repository tests. In SQLite these values compare as blobs, not as numbers. Ask the user to confirm this choice, or have the design name the SQLite column type explicitly.
  - evidence: (none)
- [tests] No test for multi-column FK being ignored, isGenerated, or unknown kind
  - location: test/introspect.sqlite.test.ts
  - detail: Design mapping rules say multi-column foreign keys are ignored, isGenerated is true when column.generated is defined, and unsupported dataTypes (e.g. blob buffer) map to kind unknown. None is asserted or present in a fixture, so a regression there would not fail. Add small inline-table cases if desired.
  - evidence: (none)
- [tests] Several kind assertions bundled in one test
  - location: test/introspect.sqlite.test.ts:25
  - detail: 'maps column kinds' and the PG 'maps bigint, json and timestamp' put many unrelated assertions in one test, so the first failure hides the rest. An it.each over [table, key, expected kind] would give clearer failures.
  - evidence: (none)
- [tests] SQLite test lacks explicit timestamp_ms and sqlite blob bigint pk notNull checks
  - location: test/introspect.sqlite.test.ts:31
  - detail: Minor: assertions on autoincrement PK omit notNull, which snapshots cover only implicitly. Acceptable given snapshots.
  - evidence: (none)

