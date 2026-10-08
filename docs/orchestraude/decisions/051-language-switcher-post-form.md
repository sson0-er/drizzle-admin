# 051: The language switcher is a CSRF-protected POST form to `POST <prefix>/_lang/` that returns through `safeNext`

- Date: 2026-10-09
- Status: accepted
- Changed 2026-10-09: user answer to Q15, option (b): the route is `POST /_lang/` and the reserved slug is `_lang`, not `lang`, so a model with slug `lang` keeps working (no breaking change for it).
- Changed 2026-10-09 (design review, i18n round): point 2 states that the `GET /_lang/` 404 applies to a logged-in visitor; point 8 accepts the never-valid token on a token-check 403; Consequences fixed to `_lang`.

## Context
User decision (2026-10-09): a switcher "English / 日本語" in the header of every page and on the login page. It must work without JavaScript, must not add inline scripts (the CSP pins one script hash, decision 044), must not become an open redirect (return to the current page with `safeNext`-style path-only rules), and must follow the CSRF rules if it is a POST. Open for the designer: GET link or POST form, the route, and the pages it appears on.

## Decision
1. Route `POST /_lang/` (relative to the mount point), registered in both auth modes after the logout route and before `/:model/` (routes.md route 3a). The slug `_lang` is added to the reserved slugs (`login`, `logout`, `static`, `_lang`), so `register()` rejects a model with slug `_lang`; a model with slug `lang` is unaffected (user answer to Q15, option (b)).
2. Middleware: the Origin check and the `_csrf` token check apply as for every POST. The auth guard exempts `POST /_lang/` in both auth modes, so a logged-out visitor can switch on the login page and on the external-mode 401 page. No GET route exists; `GET /_lang/` is not exempt from the auth guard, so a logged-out visitor is redirected to login (builtin) or `loginUrl` / 401 (external) like for any page, and a logged-in visitor reaches the list route and gets 404 (reserved slug, no model).
3. Handler `langHandler` (`src/routes/lang.ts`): from `c.var.body`, `lang` and `next` count only when they are strings. If `isLocale(lang)`, `writeLocale(c, { prefix, publicOrigin }, lang)`; otherwise no cookie is written. In every case the answer is `303` with `Location: safeNext(next, prefix)` (a missing or unsafe `next` gives `${prefix}/`). No flash is set.
4. Markup, rendered by `Layout` inside `#header` whenever `PageChrome.currentUrl` is not `null`:
   ```html
   <div class="header-tools">
     <form class="lang-switch" method="post" action="{prefix}/_lang/" aria-label="{t.language}">
       <input type="hidden" name="_csrf" value="{csrfToken}">
       <input type="hidden" name="next" value="{currentUrl}">
       <button type="submit" name="lang" value="en" lang="en" [aria-current="true" when locale is en]>English</button>
       /
       <button type="submit" name="lang" value="ja" lang="ja" [aria-current="true" when locale is ja]>日本語</button>
     </form>
     <!-- existing div.user-tools, unchanged, when a user is logged in -->
   </div>
   ```
   Button order follows `LOCALES`; texts come from `LOCALE_NAMES`. The ` / ` between the buttons is a glyph-only literal (decision 033 item 11). No script, no `style` attribute, no inline event handler: the CSP is unchanged.
5. `currentUrl` (new `PageChrome` field, `string | null`): `pageChrome` sets it to `url.pathname + url.search` of `new URL(c.req.url)`, the raw percent-encoded path, as `safeNext` requires (decision 032). The login page sets it to `loginRedirectUrl(prefix, next)`, so the login target survives a switch even after a failed POST. The `minimal` chrome (`onError` pages, Origin-check 403) sets `null`: those pages have no CSRF token, so they show no switcher; they are still rendered in the current locale.
6. A page rendered by a POST (400 form re-render, action confirmation, failed login) returns to the GET of the same URL after a switch; unsaved form input is lost, as with any navigation.
7. CSS (views-style.md): `.header-tools` lays out the switcher and the user tools; the switch buttons reuse the `#header button` text-button style and focus rule; the button with `aria-current="true"` is shown as plain bold text.
8. Accepted limitation (design review, i18n round): a token-check 403 caused by a missing or invalid session (a POST without a valid `da_session`, e.g. a guard-exempt POST to `/login/` or `/_lang/` without the cookie, or an external-mode POST after the session expired while `getUser` still returns a user) is a non-minimal page, so it shows the switcher with the transient session's token, which was never stored. Submitting it fails again with 403. This is harmless: the next GET of any page writes a session and its token works. No special case is added (`currentUrl` stays set on that page).

## Alternatives considered
- GET link (`<a href="{prefix}/_lang/ja/?next=...">`): needs no token and would also work on the minimal pages, but a GET would change state: a cross-site link or a link prefetcher could switch the language, and every other state change (logout included) is a POST with the token. Rejected for consistency with the project's security rules.
- `<select>` that submits on change: needs JavaScript (an inline handler or a new script, so a CSP change).
- Return to the `Referer` instead of a `next` field: not always sent (browser privacy settings), and it would still need `safeNext`; an explicit field is testable.
- A `?lang=` query parameter on every page: every link and redirect would have to carry it, or a GET would set the cookie.
- Showing the switcher on minimal pages with a GET fallback: two mechanisms for two rare pages.
- Reserve `lang` (the first design): a table named `lang` would stop registering, a breaking change; rejected by the user in favor of `_lang` (Q15).
- No reserved name, the switch as `POST <prefix>/` in the dashboard catch-all: no breaking change, but the GET-only catch-all that carries the decision 029 redirect rules would gain a POST branch (Q15 option (c), not chosen).

## Rationale
Buttons with `name="lang"` in one form submit the chosen value without JavaScript. `aria-current="true"` marks the current item in a set and is allowed on a button; a `lang` attribute per language name lets screen readers pronounce `日本語` correctly on an English page (evidence: 2026-10-09-aria-current-and-lang-attribute). `safeNext` already guarantees a path-only `Location` under the prefix (decision 032), so the routes' `Location` invariant (decision 029) holds without new rules. The reserved-slug list exists for exactly this kind of fixed route (evidence: 2026-10-09-messages-usage-in-src).

## Consequences
- routes.md (route table, auth exemptions), routes-handlers.md (`langHandler`, login `currentUrl`), views.md (`PageChrome.currentUrl`, `Layout` header), views-style.md (switcher rules), admin.md (reserved slug `_lang`), project-setup.md (README, CHANGELOG), test-strategy.md.
- A model registered with slug `_lang` now throws at `register()` (table names starting with `_` are rare); the CHANGELOG notes the new reserved slug. A slug `lang` stays valid.
- Pages rendered by `onError` and the Origin-check 403 have no switcher.
