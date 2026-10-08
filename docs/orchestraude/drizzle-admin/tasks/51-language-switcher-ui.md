---
id: 51-language-switcher-ui
depends_on: [49-i18n-dictionaries-and-request-locale, 50-language-switch-route]
status: pending
attempts: 0
---
# Task 51: language-switcher-ui

## Goal
Internationalization, part 3 (decision 051 points 4-8, views-style.md "Language switcher"):
- Every page's header contains `div.header-tools`. Inside it are the switcher `form.lang-switch`, which POSTs to `<prefix>/_lang/` with `_csrf`, `next` = `currentUrl` and one `button[name=lang]` per locale, and then the existing `div.user-tools`.
- `PageChrome` gains `currentUrl: string | null`. `pageChrome` sets it to the raw path plus query of the request. The login page sets it to `loginRedirectUrl(prefix, next)`. The minimal chrome (Origin-check 403, `onError` pages) sets `null`, so those pages have no switcher.
- `ADMIN_CSS` gains the three switcher rules.

After this task the switcher works without JavaScript on every non-minimal page, including the login page and the external-mode 401 page.

## Scope
### Files to touch
- src/views/layout.tsx (`PageChrome.currentUrl`, `div.header-tools`, switcher)
- src/routes/context.ts (`currentUrl` in `pageChrome` and the minimal chrome)
- src/routes/login.ts (`currentUrl` override in `renderLogin`)
- src/static/admin-css.ts (three new rules, placed per views-style.md)
- test/views.test.ts, test/widgets.test.ts, test/admin-css.test.ts, test/i18n.test.ts

### Do not touch
- src/messages.ts (`LOCALES`, `LOCALE_NAMES` and `language` exist since task 49)
- src/routes/lang.ts, src/routes/middleware.ts, src/routes/index.ts, src/auth/** (task 50)
- Every other view (`src/views/*.tsx` except layout.tsx): the switcher lives only in `Layout`
- src/static/select-all.ts and the CSP (`buildCsp`): the switcher adds no script, no `style` attribute and no inline handler (decision 044)
- Every existing rule in `ADMIN_CSS` (only the three switcher rules are added)
- src/index.ts, src/introspect/**, src/data/**, src/forms/**, example/**
- README.md, CHANGELOG.md, CLAUDE.md (task 52), package.json, biome.json, vitest.config.ts
- test/helpers/**, test/fixtures/**, every test file not listed above
- docs/** (except this task's History)
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md (one case per `it.each` row, exact assertions).

- **Markup** (views.md "Layout and common props" and "Language switcher"; decision 051 point 4): `<header id="header">` keeps the site title link. After it comes `<div class="header-tools">`, rendered even when empty. Inside it, in this order:
  - when `currentUrl !== null`, `<form class="lang-switch" method="post" action={`${prefix}/_lang/`} aria-label={t.language}>` with the hidden `_csrf` (`csrfToken`), the hidden `next` (`currentUrl`) and one `<button type="submit" name="lang" value={l} lang={l}>` per `l` of `LOCALES`. Each button's text is `LOCALE_NAMES[l]`. `aria-current="true"` appears only on the button whose value equals `locale`; on the other button the attribute is absent. The buttons are separated by the glyph literal ` / `;
  - the existing `div.user-tools` block, unchanged.

  Import `LOCALES` and `LOCALE_NAMES` (not `MESSAGES`) from messages.ts.
- **`currentUrl`** (routes.md chrome paragraph; routes-handlers.md "Login"; decision 051 point 5):
  - `pageChrome` sets `url.pathname + url.search` with `url = new URL(c.req.url)`: the raw percent-encoded path, not `c.req.path`.
  - The minimal chrome sets `null`.
  - `renderLogin` overrides it with `loginRedirectUrl(prefix, next)`, using the vetted `next` that it renders into the hidden field. This keeps the login target across a switch, also after a failed POST.
  - A token-check 403 keeps a non-null `currentUrl` (decision 051 point 8, accepted limitation).
- **CSS** (views-style.md "Language switcher"): add the three rules verbatim (`.header-tools`, `.lang-switch`, `#header .lang-switch button[aria-current=true]:not(:focus-visible)`). Place them after the `#header button` rules and before the focus-ring block (`:focus-visible {`). `ADMIN_CSS_VERSION` changes by itself.
- **Fixture and assertion edits** (test-strategy.md "Migration of existing tests"). `PageChrome`-typed fixtures in test/views.test.ts and test/widgets.test.ts gain `currentUrl: "/admin/authors/"`, so every rendered `Layout` in those tests contains the switcher. Then make exactly the allowed edits 2-5 (line numbers as of commit 2a80a06; find them by content after task 49):
  - edit 2: views.test.ts, logout form only with `showLogout`. The two `qsa(..., { tag: "form" })` counts for `render({ showLogout: false })` and `render({ user: null, showLogout: false })` become `qsa(..., { tag: "form", attrs: { action: "/admin/logout/" } })`, still `toHaveLength(0)`;
  - edit 3: views.test.ts, LoginPage hidden `next`. Query inside the login form: `q1(q1(doc, { tag: "form", id: "login-form" }) as Element, { tag: "input", attrs: { type: "hidden", name: "next" } })`, value still `/admin/authors/?q=a`;
  - edit 4: views.test.ts, logout icon. `q1(q1(doc, { tag: "div", cls: "user-tools" }) as Element, { tag: "button" })`, same expectations (`["logout"]`, text `messages.logout`);
  - edit 5: widgets.test.ts, three save buttons only when `canSave`. `names(doc)` collects buttons inside `qs(doc, { tag: "form", id: "model-form" })`; expected still `["_save", "_addanother", "_continue"]` and `[]`.
- **New tests** (test-strategy.md "Internationalization"; it.each, one case per row):
  - test/views.test.ts:
    - `Layout` with `locale` `en` / `ja` (it.each). `form.lang-switch` has `method=post`, `action=/admin/_lang/`, `aria-label` = `MESSAGES[locale].language`, the `_csrf` hidden input, and `input[name=next]` with `value` = `currentUrl`. There are exactly two `button[name=lang]`, values `en`, `ja` in that order, with texts `English` / `日本語` and `lang` attributes `en` / `ja`. `aria-current="true"` is on the current locale's button only.
    - `currentUrl: null` → no `form.lang-switch`, and `div.header-tools` exists.
    - With a user and `showLogout`, `div.user-tools` is inside `div.header-tools`, after the form.
    - A rendered `Layout` page has no `script` element, no `style` attribute and no `on*` attribute.
    - A `currentUrl` with `"><script>` in its query renders as one attribute value: no extra element, and the value round-trips.
  - test/admin-css.test.ts: `ADMIN_CSS` contains `.header-tools`, `.lang-switch` and `#header .lang-switch button[aria-current=true]:not(:focus-visible)`. The index of the last one is smaller than the index of `:focus-visible {`.
  - test/i18n.test.ts (both dialects):
    - **Logged out (builtin).** `GET /admin/login/?next=%2Fadmin%2Fauthors%2F` shows `form.lang-switch` with `next` = `/admin/login/?next=%2Fadmin%2Fauthors%2F`. Posting that form (its token, `lang=ja`) → 303 to that URL. After a failed login POST, the switcher's `next` is still `/admin/login/?next=%2Fadmin%2Fauthors%2F`.
    - **External mode** without `loginUrl`, `getUser` → null. The 401 page shows `form.lang-switch`, and POST `/admin/_lang/` with that page's token → 303.
    - **Minimal pages.** With `da_lang=ja`, the Origin-check 403 page and a throwing-formatter 500 page have no `form.lang-switch`. A normal page (e.g. the dashboard) has one with `next` = its path.
    - **CSP.** On a `da_lang=ja` page, the `Content-Security-Policy` header equals the exact builtin policy of the §10 response-headers row.
- Fails-first: write the new tests (and the fixture `currentUrl`) before the source change and run them on the code after task 50. The switcher, `div.header-tools`, CSS-rule, login-`next` and external-401 cases must fail there. The "no script / style / on*", minimal-page and CSP cases are expected to pass on the old code too; they pin what the switcher must not add. Record the observed failures in History.
- No new export is expected. `currentUrl` is a design prop. Record any other export or prop in History.

## Definition of Done
- [ ] src/views/layout.tsx imports `LOCALES` and `LOCALE_NAMES`, does not name `MESSAGES`, and renders the language names only from `LOCALE_NAMES`.
- [ ] `currentUrl` is set from `new URL(c.req.url)` (pathname + search) in `pageChrome`, to `null` in the minimal chrome, and to `loginRedirectUrl(prefix, next)` in `renderLogin`.
- [ ] The three switcher rules are in `ADMIN_CSS` after the last `#header button` rule and before `:focus-visible {`. No other line of `ADMIN_CSS` changed (`git diff src/static/admin-css.ts` shows only added lines).
- [ ] Tests (test/views.test.ts): the switcher per locale, `currentUrl: null`, user-tools placement, no script/style/on*, and `currentUrl` escaping cases pass.
- [ ] Tests (test/admin-css.test.ts): the switcher rules and their order before `:focus-visible {` pass.
- [ ] Tests (test/i18n.test.ts, both dialects): Logged out (builtin), External mode, Minimal pages and CSP cases pass.
- [ ] Test diff rule. The removed or changed lines of `git diff test/` are exactly:
  - (a) `PageChrome` fixtures gaining `currentUrl: "/admin/authors/"`;
  - (b) the allowed edits 2, 3, 4 (test/views.test.ts) and 5 (test/widgets.test.ts) of test-strategy.md "Migration of existing tests", as listed in the notes above;
  - (c) import-line additions allowed by decision 041.

  No assertion is deleted, weakened or skipped.
- [ ] History records the fails-first run.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes
- [ ] Manual (user, browser): `pnpm example`; switch on the login page and on a list page with JavaScript disabled; focus ring on both switch buttons in light and dark mode. Reported as 未確認 until the user checks.

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md#Layout and common props (incl. "Language switcher")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views-style.md#Reference rules ("Language switcher" paragraph, and the focus-ring order below it)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (API: the 2026-10-09 chrome paragraph on `currentUrl`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md#Login (`GET|POST /login/`, builtin only)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md#`redirect.ts` (`loginRedirectUrl`)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#Internationalization (decisions 049-051) (Migration edits 2-5; `views.test.ts`; CSS; `i18n.test.ts` logged out, external, minimal pages, CSP)
- Decisions: docs/orchestraude/decisions/051-language-switcher-post-form.md (points 4-8)
- Evidence: docs/orchestraude/evidence/2026-10-09-aria-current-and-lang-attribute.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
