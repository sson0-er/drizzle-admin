# Review findings

high: 0, medium: 1, low: 4

## high


## medium

- [03-design-review] Test migration says existing assertions stay as they are, but the header switcher breaks several of them
  - location: docs/orchestraude/drizzle-admin/03-design/test-strategy.md
  - detail: Under 'Migration of existing tests', view props built through the test chrome helper gain a `currentUrl`, and 'the assertions stay as they are'. With a non-null currentUrl, Layout renders form.lang-switch with two button[type=submit] and a _csrf input on every page. That breaks these current assertions: test/views.test.ts:236-237 expect zero `form` elements when showLogout is false (the switcher form is now present); test/views.test.ts:722 takes the first `button` in `header` as the logout button (it is now the 'English' switch button); test/widgets.test.ts:401-407 expects the named buttons on FormPage to be exactly [_save, _addanother, _continue] (now `lang`, `lang` come first). In addition, test/config.test.ts:157 expects `siteTitle: messages.defaultSiteTitle` in the full AdminState shape, which becomes `null` (the migration text covers only the default/kept case). The Icons section line 'every other existing test passes without modification' is no longer true either. If a task DoD limits test diffs (decision 041), the implementer would be blocked. Fix: either make the views/widgets test chrome default to `currentUrl: null`, so the switcher is absent and these assertions hold, with the new switcher cases setting it explicitly; or list these assertions as the allowed edits, scoping the selectors to `div.user-tools` / `form#model-form` / `div.header-tools` and changing config.test.ts:157 to `siteTitle: null`.
  - evidence: (none)

## low

- [03-design-review] The `[binary]` cell text has no path to the dictionaries and is not on the exempt list
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md
  - detail: format.ts rule 9 renders `[binary]` for Uint8Array/Buffer values. It is a word, not a glyph. support.md's exempt list (`‹ › ✓ ✗ - … --------- ******** /`) does not include it, and no dictionary key exists, so under the new rule ('every UI string ... in both the en and ja dictionaries') it stays English in the ja locale with no stated reason. Fix: either add it to the exempt list as a technical marker (support.md and the CLAUDE.md rule text), or add a `binary` key and pass `t` to formatCell / formatValue.
  - evidence: (none)
- [03-design-review] forms.md: local `t = raw.trim()` collides with the new `t: Messages` parameter; DisplayValue markup omits `t`
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md
  - detail: coerceForm now takes `t: Messages`, and rule 2 says every error is `t.<key>`. Rule 3 (number, bigint) still names the trimmed input `t = raw.trim()`, so a literal implementation shadows the dictionary in exactly the branches that need `t.invalidNumber` / `t.invalidInteger`. Rename the local (e.g. `s`). Also, the widgets paragraph still shows `<BooleanMark value={value} />` without the now-required `t` prop, while the signature note above it says DisplayValue passes `t`.
  - evidence: (none)
- [03-design-review] Small stale or inconsistent references in the i18n edits
  - location: docs/orchestraude/decisions/051-language-switcher-post-form.md
  - detail: (1) Decision 051 Consequences still says 'admin.md (reserved slug `lang`)'; it should be `_lang`. (2) auth.md `locale.ts` shows only `import type { Locale }`, and the README component table lists auth's dependency on support as the '`Locale` type', but readLocale needs the values `isLocale` and `DEFAULT_LOCALE`. (3) The CLAUDE.md design-principle text is given twice with different wording, in decision 049 point 12 and in README 'Project rules affected' (the README version adds 'or a module-level constant' and 'user-provided labels are not translated'). State which one the task copies. (4) The i18n test 'GET /admin/_lang/ → 404' and decision 051 point 2 do not say the visitor is logged in; a logged-out builtin visitor gets a 302 to login.
  - evidence: (none)
- [03-design-review] On a token-check 403 caused by a missing session, the switcher carries a token that can never validate
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md
  - detail: For a non-GET request without a valid session, the session middleware keeps a transient anonymous session that it does not write. The csrfToken 403 page is non-minimal, so pageChrome renders the switcher with that transient token. Clicking it sends a new transient session and fails again with 403. This happens in external mode after the session expired while getUser still returns a user, and for a guard-exempt POST (login, _lang) without a cookie. Harmless, since the next GET issues a session. Fix: either accept it in decision 051 (point 6 or Consequences), or set `currentUrl: null` when the session was not persisted.
  - evidence: (none)

