# drizzle-admin

Project conventions for contributors and coding agents. The full design lives in `docs/orchestraude/drizzle-admin/03-design/` and decisions in `docs/orchestraude/decisions/`.

## Conventions
- Do not add single-use alias variables such as `const model = found`; use or rename the original binding.
- Do not keep guards, branches or throws that the preceding code already makes impossible (re-narrowing, dead fallbacks, `String()` wrappers); use a non-null assertion with a short why-comment when the type system cannot see it.
- In tests, put independent input/expected cases in an `it.each` table (one case per row) instead of for-loops or many unrelated expects in one `it`; use exact status/flash assertions, not `not.toBe(...)`.
- Do not add tests or assertions that another test in the same file already fully implies (typeof checks before a call, a regex next to an exact-message match, `not.toBe` before `toBe`).
- Small duplication (one-line helpers, option literals, JSX, test setup) in up to three places is acceptable; extract a shared helper only at the fourth copy or when the copies must stay in sync for correctness (e.g. cookie security attributes).
- Keep helpers and constants module-private unless another module imports them; any export or prop not in the design must be recorded in the task History so the design is updated.
