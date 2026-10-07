# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] update() parses the PK twice on the empty-data path
  - location: src/data/repository.ts:104
  - detail: update() parses the PK, then delegates to get(meta, pk), which parses it again. Harmless; could be avoided by splitting get into a parsed-value helper.
  - evidence: (none)
- [spec] design ambiguity: create throws when insert returns no row
  - location: src/data/repository.ts:103
  - detail: data.md specifies create as `insert(table).values(data).returning()` -> `[0]` with return type Promise<DbRow>, and does not say what happens on an empty result. The implementation throws a plain Error ("insert ... returned no row") in that case. This path is practically unreachable with `.returning()`, so the behavior is harmless. If the design should state it, add one line to data.md; otherwise leave it as is.
  - evidence: (none)
- [tests] Backslash search test cannot detect a broken escape
  - location: test/repository.test.ts:113
  - detail: The test only asserts an empty result for q="\\". If no fixture title contains a backslash, a missing or incorrect escape would usually still return no rows (or throw on PG, which would fail). Add a fixture row containing a backslash and assert it is matched, or drop the test.
  - evidence: (none)
- [tests] create error test only asserts that something throws
  - location: test/repository.test.ts:261
  - detail: `rejects.toThrow()` passes for any failure, so it does not show the error is the unchanged driver error. Assert on the error identity or message (for example a unique-constraint message pattern per dialect).
  - evidence: (none)
- [tests] PG events block duplicates setup and hardcodes the dialect
  - location: test/repository.test.ts:347
  - detail: The block repeats the make()/cleanup boilerplate and passes the literal "postgres" instead of fx.dialect. Consider sharing the setup helper.
  - evidence: (none)

