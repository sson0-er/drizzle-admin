---
id: 49-i18n-dictionaries-and-request-locale
depends_on: [48-example-host-guard-and-docs]
status: done
attempts: 0
---
# Task 49: i18n-dictionaries-and-request-locale

## Goal
Internationalization, part 1 (decisions 049 and 050 read side):
- `src/messages.ts` holds two dictionaries, `en` (default) and `ja`, behind `MESSAGES`, typed so that a key missing from `ja` fails `pnpm typecheck`. The old `messages` export is gone.
- Every request reads the unsigned `da_lang` cookie first (`readLocale`, new `src/auth/locale.ts`). `initVars` sets `c.var.locale` and `c.var.t = MESSAGES[locale]`. A missing or invalid value means English.
- Every handler, middleware, `onError`, form function and view takes its texts from that dictionary (`c.var.t`, a `t` argument or prop). No translated text is bound at module level or at `createAdmin`. `<html lang>` follows the locale.
- `AdminState.config.siteTitle` is `string | null`; the chrome shows `config.siteTitle ?? t.defaultSiteTitle`.
- Existing tests run on `MESSAGES.en`.

Without a `da_lang` cookie, the admin is English after this task. Sending `da_lang=ja` gives the previous Japanese UI. The cookie writer, the switch route (task 50) and the header switcher (task 51) are not part of this task.

## Scope
### Files to touch
- src/messages.ts (rewrite per support.md)
- src/auth/locale.ts (new: `LOCALE_COOKIE`, `readLocale` only)
- src/types.ts (`AdminState.config.siteTitle: string | null`)
- src/admin.ts (only the `siteTitle` line in `createAdmin` and the `messages` import)
- src/forms/coerce.ts, src/forms/schema.ts, src/forms/validate.ts, src/forms/widgets.tsx
- src/views/format.ts, src/views/icons.tsx, src/views/layout.tsx, src/views/dashboard.tsx, src/views/list.tsx, src/views/form.tsx, src/views/delete.tsx, src/views/confirm-action.tsx, src/views/login.tsx (and src/views/error.tsx only if it needs `t`)
- src/routes/context.ts, src/routes/middleware.ts, src/routes/index.ts, src/routes/dashboard.ts, src/routes/list.ts, src/routes/actions.ts, src/routes/form.ts, src/routes/delete.ts, src/routes/login.ts
- test/helpers/app.ts (add `Client.setCookie` only, see notes)
- Migrated test files (mechanical, see DoD): every test file that imports `messages` (views, form, icons, delete, schema, auth, actions, widgets, coerce, list, pages, flash, config, messages), plus test/format.test.ts and any other test file that calls a function or component whose signature gains `t`
- New: test/locale.test.ts, test/i18n.test.ts

### Do not touch
- `writeLocale`, `LOCALE_MAX_AGE_SEC`, `src/routes/lang.ts`, the `_lang` route and the reserved slug (task 50)
- `PageChrome.currentUrl`, `div.header-tools`, the switcher markup, `src/static/admin-css.ts` (task 51)
- src/index.ts (exports nothing new, decision 049 point 11), src/introspect/**, src/data/**, src/auth/{session,csrf,flash,redirect,permissions}.ts, src/time.ts, src/static/**
- Configuration errors (`drizzle-admin: ...`) and `console.error` lines: they stay English literals where they are (decision 049 point 6)
- example/**, README.md, CHANGELOG.md, CLAUDE.md (task 52), package.json, biome.json, tsconfig*.json, vitest.config.ts
- test/fixtures/**, test/helpers/db.ts, test/helpers/html.ts; every existing assertion except the edits listed in the DoD
- docs/** (except this task's History)
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md (one case per `it.each` row, exact assertions, no module-level single-use aliases). This task is large but mechanical. Do it in this order so the typecheck guides you: messages.ts → locale.ts → forms and views signatures → routes → tests.

- **`src/messages.ts`** (support.md "`src/messages.ts`", decision 049 point 1): write `const en = { ... }` without `as const`, then `export type Messages = Readonly<typeof en>` and `const ja: Messages = { ... }`. Copy the key order and texts from support.md. `ja` is today's wording unchanged, plus `language: "言語"` and `binary: "[バイナリ]"`. `en` includes `language: "Language"` and `binary: "[binary]"`. Also export `type Locale = "en" | "ja"`, `LOCALES: readonly Locale[] = ["en", "ja"]`, `DEFAULT_LOCALE: Locale = "en"`, `isLocale(v: unknown): v is Locale` (true exactly for the strings `"en"` and `"ja"`), `MESSAGES: Readonly<Record<Locale, Messages>> = { en, ja }` (declared after both) and `LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: "English", ja: "日本語" }`. `en` and `ja` stay module-private. Update the file's header comment: it should say the file holds the UI strings per locale.
- **`src/auth/locale.ts`** (auth.md "`locale.ts`", decision 050 point 2): `export const LOCALE_COOKIE = "da_lang"`; `export function readLocale(c: Context): Locale` returns `v` when `isLocale(v)` for `v = getCookie(c, LOCALE_COOKIE)` (hono/cookie, unsigned), else `DEFAULT_LOCALE`. It never writes or deletes the cookie.
- **Routes** (routes.md "API", "Middleware order" step 0, "Error handling"; routes-handlers.md "Texts"):
  - `AdminVars` gains `locale: Locale` and `t: Messages`. `initVars` sets `locale = readLocale(c)` and `t = MESSAGES[locale]` before `await next()`. src/routes/middleware.ts is the only file in `src/` other than messages.ts that names `MESSAGES`.
  - `pageChrome` and the minimal chrome set `locale`, `t`, `siteTitle: config.siteTitle ?? t.defaultSiteTitle` and the Home crumb `t.home`. The minimal chrome reads `c.var.locale` / `c.var.t`, which `initVars` set before anything could fail, so its signature may change to take `c`.
  - `modelOr404`, `authGuard`, `csrfToken`, `notFound`, `onError` and every handler read `c.var.t`. Pass `t` to `validateSubmission({ ..., t })` and to `formatCell` / `cellBoolean`.
  - src/routes/list.ts: `DATE_PRESETS` keeps only `value` and a message key (`"today" | "past7" | "thisMonth" | "thisYear"`), or becomes a function of `t`. The labels are looked up in `t` per request.
  - src/routes/form.ts: `DB_MESSAGES` maps each DB error kind to a message key (`unique` → `"dbUnique"`, ...) that is looked up in `t`.
- **Forms** (forms.md "`coerce.ts`", "`schema.ts`", "`validate.ts`", "`widgets.tsx`"): `coerceForm(fields, body, mode, timeZone, t)`, `parseWithSchema(schema, data, t)`, `validateSubmission({ ..., t })`. `Widget` and `DisplayValue` get a `t: Messages` prop. In `coerce.ts` the trimmed number input is named `s`, not `t`, so it does not shadow the parameter (forms.md rule 3).
- **Views** (views.md "Layout and common props", "Pages", "`format.ts`", "Icons"):
  - `PageChrome` gains `locale: Locale` and `t: Messages`. `Layout` renders `<html lang={locale}>` and `t.logout`. Every page reads `props.t`.
  - `formatValue(field, value, tz, t)`. `formatCell` and `cellBoolean` args gain `t`. Rule 9 returns `t.binary`.
  - `BooleanMark` gets a `t` prop; `icons.tsx` then imports only types from messages.ts. `FormPage` passes `t` to `Widget` / `DisplayValue`, and `ListPage` passes it to `BooleanMark`.
  - The header markup stays as it is: no `div.header-tools` and no switcher yet.
- **`src/admin.ts` / `src/types.ts`** (admin.md `createAdmin` table, `siteTitle` row; "`AdminState`"): store `config.siteTitle ?? null`. src/admin.ts no longer imports anything from messages.ts.
- **Test helper**: add `setCookie(name: string, value: string): void` to `Client` in test/helpers/app.ts. It sets a value in the cookie jar, so tests can choose a locale before task 50 adds the switch route. This is a new helper member and is not in the design, so record it in History. No other change to helpers.
- **Test migration** (test-strategy.md "Internationalization", "Migration of existing tests"; decision 049 point 10): each file that imports `messages` imports `MESSAGES` instead and declares `const messages = MESSAGES.en` at module level. Calls gain `MESSAGES.en` as the new argument or prop. `PageChrome` fixtures gain `locale: "en"` and `t: MESSAGES.en`; `currentUrl` comes in task 51.
- **New tests** (test-strategy.md "Internationalization"; it.each, one case per row):
  - test/messages.test.ts, restructured (allowed edit 8): `describe.each(LOCALES)` runs the non-empty-string and function tables over `MESSAGES[locale]`. Each dictionary's key set equals the listed string keys plus `language` and `binary` plus the function keys. Formatted outputs come from one `[locale, key, arg, expected]` table: the six `en` rows of test-strategy.md and the nine existing `ja` rows unchanged. `isLocale` rows: `"en"`, `"ja"` → true; `"fr"`, `"JA"`, `"ja "`, `""`, `undefined`, `1` → false. Also pin `DEFAULT_LOCALE`, `LOCALES` and `LOCALE_NAMES`. Source guard: read every `.ts` / `.tsx` under `src/` with node:fs. No file other than src/messages.ts contains a character in U+3040-U+30FF or U+4E00-U+9FFF, and no file other than src/messages.ts and src/routes/middleware.ts contains the identifier `MESSAGES`.
  - test/locale.test.ts: `readLocale` through a small Hono app, one row per Cookie header: none → `en`; `da_lang=ja` → `ja`; `da_lang=en` → `en`; `da_lang=fr`, `da_lang=JA`, `da_lang=`, `da_lang=%E0%A4%A` → `en`; `da_lang=ja; da_lang=en` → `ja`.
  - test/views.test.ts: `Layout` it.each over `en` / `ja` → `html[lang=<locale>]`. `DeletePage` per locale → `p.confirm-text` equals `MESSAGES[locale].confirmDelete(label)`. `BooleanMark` with `t: MESSAGES.ja` → visually hidden `はい` / `いいえ`.
  - test/format.test.ts, test/coerce.test.ts, test/schema.test.ts, test/widgets.test.ts: one `MESSAGES.ja` case each. `formatCell` of a `Uint8Array` → `[バイナリ]`. An empty required field → `MESSAGES.ja.required`. A zod failure → `MESSAGES.ja.invalidValue`. A `tooMany` FK widget renders `MESSAGES.ja.openRelated` and `MESSAGES.ja.fkTooMany`.
  - test/i18n.test.ts (new, both dialects via `describe.each(dialects)`, `makeAdmin` client, locale set with `client.setCookie("da_lang", ...)`). Cases from test-strategy.md `i18n.test.ts`:
    - "Default": logged in with no `da_lang` → `html[lang=en]`, Home crumb `MESSAGES.en.home`, `title` ending in `| Site administration`, and no `da_lang` Set-Cookie.
    - "Japanese": one row per page (dashboard; `authors` list with the result count and the `articles.publishedAt` date presets, so register `articles` with `listFilter: ["publishedAt"]`; add 400 with an empty `name`; flash after a successful add; `GET /admin/nosuch/` 404; logged-out login page).
    - `da_lang=fr` → English and not rewritten.
    - "Not translated": `siteTitle: "My Admin"`, and a model label and a custom action label identical in both locales.
    - "Minimal pages": with `da_lang=ja`, the Origin-check 403 shows `MESSAGES.ja.csrfFailed` and `html[lang=ja]`; a throwing formatter gives a 500 with `MESSAGES.ja.serverError`; the `console.error` first argument is still `"drizzle-admin:"`.
    - The switch, CSRF, `_lang` route and switcher cases belong to tasks 50 and 51. Do not write them here.
- Fails-first: write the new tests before the source change and run them against the unchanged code. Expected failures: the missing exports (`MESSAGES`, `readLocale`); the "Default" and `da_lang=fr` integration cases (Japanese text, `lang="ja"`, `サイト管理`); the `[バイナリ]` and dictionary-argument unit cases. The `da_lang=ja` integration rows are expected to pass on the old code, because the old UI is Japanese. They are the guard against texts frozen at module level in English. Record the observed failures in History.
- Expected new exports, all in the design: `MESSAGES`, `Messages`, `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `isLocale`, `LOCALE_NAMES` (messages.ts); `LOCALE_COOKIE`, `readLocale` (auth/locale.ts). Record any other new export or prop in History.

## Definition of Done
- [ ] `grep -rnE "import \{[^}]*\bmessages\b" src` finds nothing, and src/messages.ts has no `export const messages`. `grep -rlw "MESSAGES" src` lists exactly src/messages.ts and src/routes/middleware.ts.
- [ ] `grep -rnP "[\x{3040}-\x{30FF}\x{4E00}-\x{9FFF}]" src` matches only src/messages.ts.
- [ ] src/messages.ts declares `ja` as `const ja: Messages`; `en` has no `as const`. Deleting any one key from `ja` makes `pnpm typecheck` fail (checked once by hand, then reverted; recorded in History).
- [ ] src/admin.ts imports nothing from src/messages.ts; `AdminState.config.siteTitle` is `string | null`.
- [ ] src/routes/list.ts and src/routes/form.ts have no module-level constant holding a translated string. The date presets and the DB error map hold message keys, or are functions of `t`.
- [ ] src/index.ts is unchanged (`git diff --quiet src/index.ts`).
- [ ] Tests (test/messages.test.ts): per-locale key sets, the six `en` and nine `ja` formatted rows, the `isLocale` rows, the `DEFAULT_LOCALE` / `LOCALES` / `LOCALE_NAMES` pins and the source guard pass.
- [ ] Tests (test/locale.test.ts): the nine `readLocale` rows pass.
- [ ] Tests (test/i18n.test.ts, both dialects): Default, Japanese per-page rows, `da_lang=fr`, Not translated and Minimal pages cases pass.
- [ ] Tests (test/views.test.ts, test/format.test.ts, test/coerce.test.ts, test/schema.test.ts, test/widgets.test.ts): the `html[lang]` per locale, `DeletePage` per locale, `BooleanMark` ja, `[バイナリ]`, `required`, `invalidValue` and `tooMany` ja cases pass.
- [ ] Test diff rule. The removed or changed lines of `git diff test/` (new files excluded) are exactly:
  - (a) `import { messages } ...` lines replaced by an import of `MESSAGES`, plus `const messages = MESSAGES.en;`;
  - (b) calls of `coerceForm`, `parseWithSchema`, `validateSubmission`, `formatValue`, `formatCell`, `cellBoolean`, `Widget`, `DisplayValue` and `BooleanMark` gaining the `t` argument or prop (`MESSAGES.en`);
  - (c) `PageChrome`-typed fixtures gaining `locale: "en"` and `t: MESSAGES.en`;
  - (d) these allowed edits from test-strategy.md "Migration of existing tests":
    - edit 1: views.test.ts Layout skeleton `qsa(doc, { tag: "html", attrs: { lang: "ja" } })` → `lang: "en"`, still length 1;
    - edit 6: config.test.ts siteTitle default case → "is null when absent and keeps a given title", `expect(resolved().siteTitle).toBeNull()`, the `"My Admin"` expectation unchanged;
    - edit 7: config.test.ts AdminState shape `siteTitle: messages.defaultSiteTitle` → `siteTitle: null`;
    - edit 8: test/messages.test.ts restructured per locale;
  - (e) import-line additions allowed by decision 041.

  test/helpers/app.ts only gains the `setCookie` member: no removed lines except the closing lines needed to insert it. No assertion is deleted, weakened or skipped.
- [ ] History records the fails-first run (which new cases failed on the old code and how), the `ja`-key typecheck check, and `Client.setCookie` as an addition not in the design.
- [ ] `git diff --name-only` lists only files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md#`src/messages.ts`
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md#`locale.ts` (decision 050) (`readLocale` only)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (API `AdminVars` and chrome paragraph; Middleware order step 0; Error handling)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md#Texts (Changed 2026-10-09, decision 049)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (`coerce.ts`, `schema.ts`, `validate.ts`, `widgets.tsx`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (Layout and common props without the switcher; Pages; `format.ts`; Icons `BooleanMark`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (`createAdmin` `siteTitle` row; `AdminState`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#Internationalization (decisions 049-051)
- Design: docs/orchestraude/drizzle-admin/03-design/README.md (Data flow step 3; Error handling)
- Decisions: docs/orchestraude/decisions/049-i18n-message-dictionaries.md, docs/orchestraude/decisions/050-locale-cookie.md (points 2, 6)
- Evidence: docs/orchestraude/evidence/2026-10-09-messages-usage-in-src.md, docs/orchestraude/evidence/2026-10-09-hono-plain-cookie-read.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

### Attempt 1: done
- Implemented per the design: `en` / `ja` dictionaries behind `MESSAGES` (src/messages.ts), `readLocale` (src/auth/locale.ts), `initVars` sets `c.var.locale` / `c.var.t`, every route, form function and view takes `t`, `<html lang>` follows the locale, `AdminState.config.siteTitle` is `string | null` (chrome uses `siteTitle ?? t.defaultSiteTitle`). `minimalChrome` now takes `c` and reads `c.var.locale` / `c.var.t`. `DATE_PRESETS` (list.ts) and `DB_MESSAGES` (form.ts) hold message keys looked up in `t`.
- Fails-first: the new and changed tests were run against the old `src/` (`git stash push -- src`, then popped). All eight files (messages, locale, i18n, views, format, coerce, schema, widgets tests) failed at once, because they import the missing `MESSAGES` / `readLocale` or call the changed signatures, so single cases such as the "Default" and `da_lang=fr` integration rows could not be observed failing separately on the old code (41 failed tests in 8 failed files; several files failed at import). The `da_lang=ja` rows guard against texts frozen in English at module level; they are expected to pass on the old Japanese UI and could not be run separately.
- `ja` key check: removing `binary` from `ja` made `pnpm typecheck` fail with `src/messages.ts(80,7): error TS2741: Property 'binary' is missing in type ...`; reverted afterwards.
- Additions not in the design: `Client.setCookie(name, value)` in test/helpers/app.ts (puts a value into the cookie jar so tests can choose a locale before task 50). No other new export or prop beyond the design list.
- Test diff notes: test/config.test.ts no longer uses `messages` after edits 6 and 7, so its `MESSAGES` import and the `const messages = MESSAGES.en;` line were dropped (an unused import would fail lint). test/messages.test.ts is restructured (edit 8). The `BooleanMark` ja case is in test/views.test.ts.
- Review round 1: high 0, medium 0, low 3 (spec: coerce.ts local named trimmed not s; readLocale row count 8 cases + LOCALE_COOKIE check; tests: redundant typeof check in messages.test.ts). Removal of the unused MESSAGES import in test/config.test.ts accepted by spec review. Done.
