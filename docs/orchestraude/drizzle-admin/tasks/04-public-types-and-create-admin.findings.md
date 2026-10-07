# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] Redundant db check
  - location: src/admin.ts:46
  - detail: `db === undefined` is already covered by `typeof db !== "object"`. Simplify to `db === null || typeof db !== "object"`.
  - evidence: (none)
- [quality] Test helper regex has a dead alternative
  - location: test/config.test.ts:16
  - detail: Error.message never starts with 'Error: ', so the first alternative is dead, and the unescaped option name is interpolated into the regex. Use `new RegExp(`^drizzle-admin: .*${option}`)`.
  - evidence: (none)
- [quality] Weak assertion on app
  - location: test/config.test.ts:26
  - detail: `"app" in admin` only checks that the key exists, so it adds little. Either drop it or assert that accessing `admin.app` throws the not-implemented error.
  - evidence: (none)
- [tests] rejects helper regex is looser than intended
  - location: test/config.test.ts:16
  - detail: The alternation `^Error: drizzle-admin: .*opt|^drizzle-admin: .*opt` never needs the first branch (toThrow matches against error.message, which has no 'Error: ' prefix). A short option name like 'db' or 'auth' would also match anywhere in the message. Use `new RegExp(`^drizzle-admin: ${option} `)` (messages start with the option name) so a failure on the wrong rule is caught.
  - evidence: (none)
- [tests] No test pins the exact public exports of src/index.ts
  - location: test/types.test.ts
  - detail: The DoD says index.ts exports exactly createAdmin plus the listed types and nothing else, but only createAdmin is exercised at runtime. Add a test asserting Object.keys(await import('../src/index.js')) equals ['createAdmin'] so that ResolvedModel, AdminState or resolveConfig cannot leak at runtime.
  - evidence: (none)
- [tests] Default time zone assertion recomputes the implementation
  - location: test/config.test.ts:114
  - detail: The default timeZone is compared against Intl.DateTimeFormat().resolvedOptions().timeZone, the same expression resolveTimeZone likely uses. Acceptable as an environment check, but it cannot fail if both share a bug. Consider asserting it is a non-empty string accepted by Intl.
  - evidence: (none)

