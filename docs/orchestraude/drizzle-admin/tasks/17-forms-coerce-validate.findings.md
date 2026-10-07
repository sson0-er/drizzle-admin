# Review findings

high: 0, medium: 0, low: 7

## high


## medium


## low

- [quality] FormBody re-exported from coerce.ts
  - location: src/forms/coerce.ts:6
  - detail: coerce.ts re-exports FormBody that already lives in ../types.js, and validate.ts imports it via coerce.js. Import it from ../types.js directly and drop the re-export to avoid a second import path for the same type.
  - evidence: (none)
- [quality] Unreachable-in-practice empty-enum fallback in baseType
  - location: src/forms/schema.ts:17
  - detail: `(meta.enumValues ?? []) as [string, ...string[]]` casts a possibly empty array to a non-empty tuple, and z.enum([]) would misbehave for an enum field without values. Coercion already rejects every choice in that case; a z.string() fallback when enumValues is empty would make the cast unnecessary.
  - evidence: (none)
- [spec] design ambiguity: whitespace-only number rejected as invalidNumber
  - location: src/forms/coerce.ts:37
  - detail: forms.md rule 3 says `Number(raw.trim())` must be finite. Read literally, "   " becomes 0 (Number("") === 0) and is accepted. The code rejects it as invalidNumber instead, and test/coerce.test.ts:88 locks that in. This is arguably the intended behavior, but the design does not say so. Ask the user whether to record it in forms.md, or to treat whitespace-only input as empty under rule 2.
  - evidence: (none)
- [spec] design ambiguity: rawValues normalizes boolean fields to "on"/""
  - location: src/forms/coerce.ts:109
  - detail: forms.md describes rawValues only as the submitted strings 'for re-render'. For kind boolean the code returns "on" or "" (through the rule-1 check) instead of the raw submitted string. This fits the checkbox widget's `checked={value === "on"}`, but the design does not describe it. Confirm it with the user and note it in forms.md.
  - evidence: (none)
- [spec] parseWithSchema is an export the design does not list
  - location: src/forms/schema.ts:41
  - detail: forms.md lists only buildZodSchema for schema.ts. It assigns the safeParse issue mapping to schema.ts but names no function for it. The extra exported helper is reasonable. Either add it to the forms.md API or keep it module-internal and test the mapping through validateSubmission.
  - evidence: (none)
- [tests] Boolean empty-string assertion sits under a 'false' test name
  - location: test/coerce.test.ts:55
  - detail: `run(f, "", "change")` expects true (empty string is present and not 0/false), but it is inside the test named 'is false for 0, false and a missing key'. Move it to its own test, for example 'treats an empty submitted value as checked', so a failure points at the right behavior.
  - evidence: (none)
- [tests] Untested edge cases: bigint whitespace trim and date kind rejecting other formats
  - location: test/coerce.test.ts:112
  - detail: The bigint case never checks that surrounding whitespace is trimmed, for example ' 5 '. The date-only Date kind (not the string variant) is only checked for 2026-02-30, so formats like 2026/10/07 are not covered there. Add one assertion for each.
  - evidence: (none)

