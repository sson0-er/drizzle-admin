# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] LOCALE_MAX_AGE_SEC exported but used only in locale.ts
  - location: src/auth/locale.ts:7
  - detail: No other module or test imports the constant. CLAUDE.md asks that helpers and constants stay module-private unless imported elsewhere; drop the export (or record it in the task History if a test is meant to import it).
  - evidence: (none)
- [quality] Guards in langHandler may duplicate type narrowing
  - location: src/routes/lang.ts:13
  - detail: `body ?? {}` and `typeof next === "string"` are needed only if FormBody values are not already string, so verify against FormBody. login.ts handles the same `next` field; reuse its pattern so both handlers read it the same way. If the type already guarantees a string, drop the typeof check per the dead-guard convention.
  - evidence: (none)
- [spec] design ambiguity: langHandler is synchronous, the design declares Promise<Response>
  - location: src/routes/lang.ts:10
  - detail: routes-handlers.md declares `export async function langHandler(c: AdminContext): Promise<Response>`. The implementation returns `Response` synchronously, which is correct because the handler awaits nothing and Hono accepts both. The task notes give no signature. Either update the design signature to `Response` or make the function async to match. Behavior does not change either way.
  - evidence: (none)
- [tests] Cookie presence asserted via length only
  - location: test/i18n.test.ts:233
  - detail: The redirects table checks `sets(res).length > 0` against a boolean, so a failure reads 'expected false to be true' and does not show which Set-Cookie was or was not sent. Assert `sets(res)` against `[]` or the exact `da_lang=ja; ...` string instead, with the expected value as a table column.
  - evidence: (none)
- [tests] Redirect-safety assertions partly imply each other
  - location: test/i18n.test.ts:229
  - detail: Each row already pins the exact Location with toBe(to). The startsWith and control-character checks add nothing for rows whose `to` is a literal safe path. Keep them only if the task wants them as a guard when new rows are added.
  - evidence: (none)

