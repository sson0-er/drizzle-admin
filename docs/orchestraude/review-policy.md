# Review policy

Project-level decisions from low-findings triage. Reviewers read this file and do not raise items covered here.

## Accepted low findings
- [quality] L001 Tuple cast in parseDatetimeLocal — style only. — accepted 2026-10-08, feature drizzle-admin
- [quality] L014 Login route registration repeats the builtin check — both places are correct; an optional comment. — accepted 2026-10-08, feature drizzle-admin
- [quality] L015 Missing fkChoices entry becomes an empty select — handled by the B decision on L061. — accepted 2026-10-08, feature drizzle-admin
- [quality] L016 Narrow-screen test asserts overflow-x on the whole stylesheet — CSS assertion precision; low regression value. — accepted 2026-10-08, feature drizzle-admin
- [quality] L020 Paginator props passed field by field — style only. — accepted 2026-10-08, feature drizzle-admin
- [quality] L021 parsePk is an alias of parseFieldValue — required by the design API; works. — accepted 2026-10-08, feature drizzle-admin
- [quality] L023 Redirect target branching duplicates checks — refactor preference. — accepted 2026-10-08, feature drizzle-admin
- [quality] L029 Registry not frozen — the register-after-app guard already prevents mutation; the comment wording is a preference. — accepted 2026-10-08, feature drizzle-admin
- [quality] L030 renderLogin re-vets next — the reviewer says no change is required. — accepted 2026-10-08, feature drizzle-admin
- [quality] L031 resolveModel does several jobs — refactor preference. — accepted 2026-10-08, feature drizzle-admin
- [quality] L032 Side-effecting counter in the seed mapper — demo code, readable enough. — accepted 2026-10-08, feature drizzle-admin
- [quality] L035 toSnapshot emits both table and tableName — changing it churns snapshots for no behavior gain. — accepted 2026-10-08, feature drizzle-admin
- [quality] L036 Unneeded returning() and `float: none` — cosmetic. — accepted 2026-10-08, feature drizzle-admin
- [quality] L038 Unreachable empty-enum fallback cast — unreachable in practice; coercion already rejects the input. — accepted 2026-10-08, feature drizzle-admin
- [quality] L039 FormPage does not read mode and modelLabel — they come from the design prop table. — accepted 2026-10-08, feature drizzle-admin
- [quality] L040 update() parses the PK twice — micro-optimization. — accepted 2026-10-08, feature drizzle-admin
- [quality] L041 Weak `"app" in admin` assertion — test cosmetics; later tasks cover app. — accepted 2026-10-08, feature drizzle-admin
- [security] L052 Unknown-action check runs before the permission check — action names are not sensitive; the impact is negligible. — accepted 2026-10-08, feature drizzle-admin
- [spec] L084 Task 01 History contradiction about `!docs` — historical record only; biome.json is correct. — accepted 2026-10-08, feature drizzle-admin
- [spec] L085 hookTimeout comment says "Same reason" — comment wording only. — accepted 2026-10-08, feature drizzle-admin
- [tests] L094 Boolean empty-string assertion under a "false" test name — naming only. — accepted 2026-10-08, feature drizzle-admin
- [tests] L098 Dark-mode test uses a loose pattern — CSS assertion precision; low regression value. — accepted 2026-10-08, feature drizzle-admin
- [tests] L104 Default time zone assertion recomputes the implementation — acceptable as an environment check. — accepted 2026-10-08, feature drizzle-admin
- [tests] L107 fetch test cannot distinguish mounting — prefix mounting is covered by the task 14 route tests. — accepted 2026-10-08, feature drizzle-admin
- [tests] L115 README key check is a substring match — README test precision; low value. — accepted 2026-10-08, feature drizzle-admin
- [tests] L120 overflow-x assertion not scoped to the narrow block — same as L016. — accepted 2026-10-08, feature drizzle-admin
- [tests] L124 Loose "required" substring assertion — it works today; precision preference. — accepted 2026-10-08, feature drizzle-admin
- [tests] L130 Session expiry test hardcodes 28800 — minor fragility; the failure would be obvious. — accepted 2026-10-08, feature drizzle-admin
- [tests] L133 Explicit notNull checks missing on the SQLite autoincrement pk — covered by snapshots. — accepted 2026-10-08, feature drizzle-admin
- [tests] L134 Tampered cookie construction is hard to follow — readability only. — accepted 2026-10-08, feature drizzle-admin

## Conventions adopted
- Do not add single-use alias variables such as `const model = found`; use or rename the original binding. — adopted 2026-10-08, feature drizzle-admin
- Do not keep guards, branches or throws that the preceding code already makes impossible (re-narrowing, dead fallbacks, `String()` wrappers); use a non-null assertion with a short why-comment when the type system cannot see it. — adopted 2026-10-08, feature drizzle-admin
- In tests, put independent input/expected cases in an `it.each` table (one case per row) instead of for-loops or many unrelated expects in one `it`; use exact status/flash assertions, not `not.toBe(...)`. — adopted 2026-10-08, feature drizzle-admin
- Do not add tests or assertions that another test in the same file already fully implies (typeof checks before a call, a regex next to an exact-message match, `not.toBe` before `toBe`). — adopted 2026-10-08, feature drizzle-admin
- Small duplication (one-line helpers, option literals, JSX, test setup) in up to three places is acceptable; extract a shared helper only at the fourth copy or when the copies must stay in sync for correctness (e.g. cookie security attributes). — adopted 2026-10-08, feature drizzle-admin
- Keep helpers and constants module-private unless another module imports them; any export or prop not in the design must be recorded in the task History so the design is updated. — adopted 2026-10-08, feature drizzle-admin
