---
id: 2026-10-09-messages-usage-in-src
question: For decisions 049-051, where do UI strings, `<html lang>` and locale-dependent formatting live in the current code, and which strings are computed outside a request?
source: repository at commit 2a80a06 (grep over src/ and test/), read locally
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `src/messages.ts` exports one `messages` object (`as const`, Japanese, 54 string keys and 9 function keys). 21 modules import it: `src/admin.ts`, `src/forms/{coerce,schema}.ts`, `src/forms/widgets.tsx`, all nine `src/routes/*.ts` and every `src/views/*.tsx` except `error.tsx`.
- Strings bound outside a request: `src/admin.ts` resolves `siteTitle: config.siteTitle ?? messages.defaultSiteTitle` at `createAdmin`; `src/routes/list.ts` holds `DATE_PRESETS` with translated labels at module level; `src/routes/form.ts` holds a module-level map from DB error kind to message text.
- No source file other than `src/messages.ts` contains Japanese characters. Configuration errors (`drizzle-admin: ...`) and log lines (`console.error("drizzle-admin:", ...)`) are English literals.
- `src/views/layout.tsx` hard-codes `<html lang="ja">`.
- `formatDateTime` / `formatDate` build `YYYY/MM/DD HH:mm` by hand from `zonedParts`; no `Intl` locale formatting reaches the UI; numbers are shown with `String(value)`.
- 14 test files import `messages`; only `test/messages.test.ts` pins Japanese literals (the function-valued messages).
- Reserved slugs are `login`, `logout`, `static` (`src/admin.ts`), slug pattern `/^[A-Za-z0-9_-]+$/`.
Not confirmed: nothing external; this is a snapshot of the code at that commit.
