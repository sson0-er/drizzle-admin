# 045: Bounds on request input: key values the DB would reject, search text, bulk selection size, integer form input

- Date: 2026-10-08
- Status: accepted

## Context
Security audit (data.findings, low; dynamic.md 6b): some request input reaches the DB in a form it rejects, and the error becomes a 500. On PostgreSQL: an integer PK or FK filter outside the int4 range (`/admin/authors/3000000000/change/`, `?f_authorId=3000000000`, SQLSTATE 22003), a non-uuid string for a uuid key (22P02) and a NUL byte in `?q=` (22021). On both dialects: a bulk action with more ids than the bind-parameter limit (SQLite ~32k). Also: `?q=` has no length cap, and integer form coercion uses `Number()`, so it accepts `0x1F`, `0b11`, `1e3` and silently rounds unsafe integers, unlike `parseFieldValue`.
User decision (2026-10-08): bad input must not produce 500 (out-of-range integer PK/FK → not found / filter ignored; NUL in `q` → strip or reject; `_selected` capped with a validation flash), cap `q` (truncate or ignore), and integer coercion follows `parseFieldValue` (plain decimal digits with an optional sign, safe-integer range, `0x`/`0b`/`1e3` rejected with a validation error). The designer picks the cap values and the NUL and length handling.

## Decision
1. Key value domains (`parseFieldValue` / `parsePk`, data.md). Introspection records the DB-enforced domain of every column of these PG types, key or not (point 4 relies on it for non-key integer fields; Changed 2026-10-08, design review wording fix), in a new optional `FieldMeta.valueCheck`: `"int16"` (PgSmallInt, PgSmallSerial), `"int32"` (PgInteger, PgSerial), `"int64"` (PgBigInt53, PgBigSerial53, PgBigInt64, PgBigSerial64) or `"uuid"` (PgUUID). It is absent on SQLite and for other column types. `parseFieldValue` returns `null` when the value is outside the domain:
   - number, integer: `/^-?\d+$/`, `Number.isSafeInteger`, and for `int16` / `int32` within -32768..32767 / -2147483648..2147483647.
   - bigint: `/^-?\d+$/`, and for `int64` within -9223372036854775808..9223372036854775807.
   - string: contains U+0000 → `null` (both dialects); `uuid` → must match `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
   - enum: must be one of `enumValues`.
   Existing callers already turn `null` into "not found" (`get`, `update` → 404) or "skipped" (`getMany`, `delete`, FK filter ignored), so no handler changes are needed for this point.
2. Search text (`listHandler`): `q` = the `q` parameter with every U+0000 removed, then trimmed, then cut to its first 200 code points (`Array.from(q).slice(0, 200).join("")`). This value is passed to `repo.list` and echoed in the search box. A longer `q` is truncated, not ignored and not an error.
3. Bulk selection (`actionsHandler`): after deduplication, more than 500 ids → warning flash `messages.tooManySelected(500)` and 303 back to the list state, after `modelOr404` and before any permission check, DB query or action `run` (the same position as the `noSelection` check). The constant `MAX_SELECTED = 500` is exported from `src/routes/actions.ts` and is the only definition of the number; `register()` imports it for point 5 (Changed 2026-10-08, design review: one shared constant instead of two copies).
4. Integer form input (`coerceForm`, forms.md rule 3): for kind number with `isInteger` and for kind bigint, after the existing whitespace-only and non-numeric checks (`invalidNumber` for kind number), the trimmed value goes through `parseFieldValue(field.meta, t)`; `null` → `invalidInteger`. So `"0x1F"`, `"0b11"`, `"1e3"`, `"1.5"`, `"+5"` and `"9007199254740993"` are `invalidInteger`, and a PG int4 field rejects `"3000000000"` as `invalidInteger` instead of a generic DB error. Non-integer number fields keep `Number()` parsing.
5. Changed 2026-10-08 (user answer to Q13): `register()` rejects `listPerPage` above `MAX_SELECTED` (500, imported from `src/routes/actions.ts`), with `<table>: listPerPage must be a positive integer of at most 500` (one message for every failure of the rule, replacing `listPerPage must be a positive integer`). A full page therefore always fits a bulk action, and the FK label lookup of the list binds at most 500 values.
6. Changed 2026-10-08 (user answer to Q14): the uuid, NUL and enum checks of point 1 are confirmed as part of the scope.

## Alternatives considered
- Catch PG 22003 / 22P02 / 22021 from the repository and treat them as "not found": hides real bugs, needs dialect error codes in the read path, and still costs a round trip; validating before the query is simpler and dialect-independent where possible.
- NUL in `q`: reject with 400, or ignore the whole search. A NUL never comes from typing in the search box, and PG cannot store it in text, so removing it is the smallest change with no error page.
- `q` above the cap: ignore the search or answer 400. Truncation keeps the page useful and the echoed box shows exactly what was searched.
- Selection cap 1000 (the user's example): the limit before SQLite 3.32.0 is 999 parameters (evidence: 2026-10-08-bind-parameter-limits), so 1000 would fail by one on older builds. 500 stays below every limit named there and is ten pages at the default `listPerPage`.
- Chunk large selections into several queries: removes the limit without a message but changes delete atomicity and hook ordering; the user asked for a cap.
- A separate integer parser in `coerce.ts`: two copies of a rule that must stay identical (the user asked for "the same rules"), so forms calls `parseFieldValue`.

## Rationale
PG raises errors for out-of-range integers, malformed uuids and NUL bytes in text parameters, and the ranges and drizzle column types are known (evidence: 2026-10-08-pg-key-input-domains). SQLite allows 32766 parameters since 3.32.0 and 999 before; PG's Bind message counts parameters in an Int16 (evidence: 2026-10-08-bind-parameter-limits). `getMany` and `delete` bind one parameter per id, so 500 ids fit everywhere listed. The uuid and enum checks go beyond the integer cases the user listed; they close the same class of 500 (the audit names uuid explicitly) at one line each; the user confirmed them (Q14).

## Consequences
- admin.md (`listPerPage` cap), introspect.md (`valueCheck`), data.md (`parseFieldValue`), forms.md (coercion rule 3; forms now imports `parseFieldValue`), routes-handlers.md (List step 2, Actions step 1), support.md (`tooManySelected`), project-setup.md (README search and actions notes), test-strategy.md.
- Remaining: other PG key types whose input syntax PG checks (numeric, date, inet) used as PK or FK can still produce a 500 for malformed input; such keys are unusual and not covered.
- Changed 2026-10-08: `listPerPage` above 500 is rejected at `register()` (point 5, Q13); this is a new restriction recorded in `CHANGELOG.md` (decision 048).
