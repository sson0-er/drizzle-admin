# Interface: views

Files: `src/views/{layout,dashboard,list,form,delete,confirm-action,login,error,icons}.tsx`, `src/views/format.ts`, `src/views/url.ts`, `src/static/admin-css.ts`, `src/static/select-all.ts`.
All components are synchronous Hono JSX functions (`hono/jsx`). Escaping comes only from Hono JSX: `raw()` and `dangerouslySetInnerHTML` are forbidden (Biome rule, decision 004). Texts come from the request's dictionary, the `t: Messages` prop ([support.md](support.md); Changed 2026-10-09, decision 049): pages read `props.t` from `PageChrome`; no view imports `MESSAGES`. Widgets come from [forms.md](forms.md). The stylesheet (`ADMIN_CSS`) is specified in [views-style.md](views-style.md).

## Responsibilities
- Render every page from plain props (no DB access, no Context).
- Format list cell values.
- Provide the stylesheet string (rules in [views-style.md](views-style.md), decision 040) and the select-all script.
- Render the fixed set of decorative icons (decision 039).

## API

### Layout and common props
Changed 2026-10-08: the breadcrumb separator glyph is exempt from the messages rule (decision 033 item 11).
Changed 2026-10-08: the logout button and each flash item start with an icon (decision 039).
Changed 2026-10-09: `PageChrome` gains `locale`, `t` and `currentUrl`; `<html lang>` follows the locale; the header gets the language switcher (decisions 049, 051).
```ts
interface PageChrome {
  locale: Locale; t: Messages;                         // request locale and its dictionary (decision 049)
  currentUrl: string | null;                           // raw path + query of this page, the switcher's `next`;
                                                       //   null → no switcher (minimal pages, decision 051)
  siteTitle: string; prefix: string; title: string;   // siteTitle already resolved: config value or t.defaultSiteTitle
  user: AdminUser | null; showLogout: boolean;        // builtin mode and logged in
  csrfToken: string; flash: FlashMessage[];
  breadcrumbs: { label: string; href?: string }[];    // first item is always Home → `${prefix}/`
}
export function Layout(props: PageChrome & { children: Child }): JSX.Element;
```
Structure (the breadcrumb separator `›` is a glyph-only literal, exempt from the messages rule, decision 033 item 11): `<html lang={locale}>` (Changed 2026-10-09; was `"ja"`), `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>{title} | {siteTitle}</title>`, `<link rel="stylesheet" href={`${prefix}/static/admin.css?v=${ADMIN_CSS_VERSION}`}>`; `<header id="header">` with the site title link and `div.header-tools` (Changed 2026-10-09, decision 051) containing, in this order, the language switcher (below; only when `currentUrl !== null`) and, if `user`, the existing `div.user-tools` with the user name and (if `showLogout`) `<form method="post" action={`${prefix}/logout/`}>` with the CSRF hidden input and `<button type="submit"><Icon name="logout" />{t.logout}</button>`; `div.header-tools` is rendered even when empty (minimal page without user); `<nav class="breadcrumbs">`; `<ul class="messagelist">` with `<li class={level}><Icon name={FLASH_ICONS[level]} />{text}</li>`; `<main id="content">`.
Every POST form contains `<input type="hidden" name="_csrf" value={csrfToken}>`.

Language switcher (Changed 2026-10-09, decision 051), inside `div.header-tools`:
```html
<form class="lang-switch" method="post" action="{prefix}/_lang/" aria-label="{t.language}">
  <input type="hidden" name="_csrf" value="{csrfToken}">
  <input type="hidden" name="next" value="{currentUrl}">
  <button type="submit" name="lang" value="en" lang="en" aria-current="true"?>English</button> / <button type="submit" name="lang" value="ja" lang="ja" aria-current="true"?>日本語</button>
</form>
```
One `button` per entry of `LOCALES`, in that order, with text `LOCALE_NAMES[l]` and `lang={l}`; `aria-current="true"` only on the button whose value equals `locale` (the attribute is absent on the other). The ` / ` text between buttons is a glyph-only literal (decision 033 item 11). No icon, no script, no `style` attribute, no inline handler (the CSP is unchanged, decision 044). Stable selectors: `form.lang-switch`, `button[name=lang][value=en|ja]`, `input[name=next]` inside it.

### Pages (all take `PageChrome` plus the listed props)
Changed 2026-10-08: `FormPage` gains the required `timeZone` prop; `values` / `displayRow` split described (decision 030).
Changed 2026-10-08: `ConfirmActionPage` gains the required `listHref` prop (decision 031).
Changed 2026-10-08: headers and filter headings keep showing the raw field key; `ListPage` gets no `label` prop (decision 035); `data-sort` reflects only an explicit `o` (decision 033 item 8); display-only hidden-widget fields keep their row and display-only `password` fields are masked (decisions 033 item 9, 037).
Changed 2026-10-08: icons on buttons and links, `Cell.bool` for boolean list cells; every selector below is unchanged (decision 039, see "Icons").
Changed 2026-10-08: display-only boolean fields on `FormPage` show `BooleanMark` through `DisplayValue` (user answer to Q9, decision 039).
Changed 2026-10-08: `ListPage` `columns[].sortHref` is `string | null`; `null` (a `password`-widget column) renders the header key as plain text without `a.sort` (decision 037 point 6, L011).

| Component | Extra props | Stable selectors used by tests |
|---|---|---|
| `DashboardPage` | `models: { slug; label; canAdd }[]` | `table#dashboard`, row `tr[data-model=<slug>]` with `a.changelink` (list) and `a.addlink` (add, only if canAdd) |
| `ListPage` | see below | `form#changelist-search` (GET; `input[name=q]`), `aside#changelist-filter` with `div[data-filter=<key>]` (heading = the field key) containing `a` links and `.selected` on the active choice, `form#changelist-form` (POST), `select[name=action]`, `button[name=index]` ("run"), `table#result_list`, `th[data-key=<key>]` with a sort link `a.sort` (text = the field key, decision 035; absent when `sortHref` is `null`, the `th` then contains only the key as text) and `data-sort="asc|desc|none"`, `input[name=_selected][value=<pk>]`, `input#action-toggle` (select all), `p.paginator` with `span.this-page` and `.result-count`, `a.addlink` |
| `FormPage` | `mode; modelLabel; groups: FormGroup[]; values; fieldErrors; formErrors; canSave; deleteHref?; displayRow?; timeZone` (see below) | `form#model-form` (POST), `fieldset.module` per group (`h2` for the title), `div.form-row[data-field=<key>]`, `p.errornote` (shown when there are any errors), `ul.errorlist`, buttons `button[name=_save]`, `button[name=_addanother]`, `button[name=_continue]`, `a.deletelink` |
| `DeletePage` | `modelLabel; objectLabel; cancelHref` | `form#delete-form`, `p.confirm-text`, `button[type=submit]` |
| `ConfirmActionPage` | `modelLabel; action: string; actionLabel; isDelete; items: { pk; label }[]; listHref: string; backQuery: string` (`listHref` = list URL `${prefix}/${slug}/`, required because `PageChrome` has no model slug; `backQuery` = query string with leading `?`, or `""`) | `form#action-confirm` (POST to `listHref + backQuery`) with hidden `action`, `_confirm=1`, one hidden `_selected` per item, `ul.objects li`; the cancel link points to `listHref + backQuery` |
| `LoginPage` | `next; username; error?` | `form#login-form` (POST `${prefix}/login/`), `input[name=username]`, `input[name=password]`, hidden `next`, `p.errornote` |
| `ErrorPage` | `status; message` | `h1`, `p.error-message` |

Changed 2026-10-09 (decision 049): every text a page renders itself (button labels, headings, `resultCount`, `formHasErrors`, `confirmDelete(...)`, `confirmAction(...)`, the login labels, ...) is `props.t.<key>`; `FormPage` passes `t` to `Widget` and `DisplayValue`, and `ListPage` passes it to `BooleanMark`. Props carrying user-provided text (`modelLabel`, `objectLabel`, `actionLabel` of a custom action, cell texts, `message` of `ErrorPage`) are rendered as given; the caller has already chosen the locale for any message it passes.

`ListPage` props:
```ts
{
  model: { slug; label }; columns: { key; sort: "asc" | "desc" | "none"; sortHref: string | null }[];
  // sortHref null → not sortable: plain-text header, no a.sort, data-sort="none" (password widget,
  //   decision 037 point 6); the handler decides, ListPage only renders
  // header text = key (decision 035); sort reflects only an explicit `o` parameter:
  // with the default ordering (M.ordering or -pk) every column is "none" (decision 033 item 8)
  rows: { pk: string; cells: Cell[] }[];
  // Cell = { text: string; href?: string; bool?: boolean } ; href for listDisplayLinks (change page) or FK links
  //   (listDisplayLinks wins when both apply, decision 033 item 4)
  // bool set (from cellBoolean, decision 039) → the cell renders <BooleanMark value={bool} /> instead of
  //   `text` (inside the `a` when href is set); bool undefined → `text` as before
  q?: string | null;  // null → hide the search box
  filters: { key: string; choices: { label: string; href: string; selected: boolean }[] }[];
  // filter heading = key (decision 035)
  actions: { name: string; label: string }[]; canAdd: boolean;
  page: number; pages: number; total: number; pageHref: (n: number) => string; backQuery: string;
}
```
Pagination shows previous/next (the glyphs `‹` / `›`, exempt from the messages rule, decision 033 item 11) and up to 5 numbers around the current page, plus `t.resultCount(total)`. JS-free: every control is a link or a form submit. Only `#action-toggle` needs JS.

`FormPage` props (decision 030):
```ts
{
  mode: "add" | "change"; modelLabel: string; groups: FormGroup[];
  values: Record<string, string>;        // form strings by field key, for editable fields only
  fieldErrors: Record<string, string>; formErrors: string[];
  canSave: boolean;                      // false → no save buttons (read-only page)
  deleteHref?: string;                   // set → a.deletelink
  displayRow?: Record<string, unknown>;  // stored row, for display-only fields only
  timeZone: string;                      // resolved AdminConfig.timeZone, for display-only date-times
}
```
Two value sources, never mixed: an editable field renders `Widget` with `values[key] ?? ""` (strings already converted by `toFormValue` on GET, or echoed from the request body on a 400 re-render); a display-only field renders `DisplayValue({ field, value: displayRow?.[key], timeZone })` from the stored row (forms.md), so it always shows the stored value even when the re-rendered form shows rejected input. `timeZone` is required because `DisplayValue` formats date-times with it (`formatValue`, rule 6 in `format.ts` below). A field with widget `hidden` (editable) renders only its input, without a `div.form-row` ("no label row", forms.md). A display-only field with widget `hidden` still renders a labelled `div.form-row` with its `DisplayValue`, because nothing is submitted for it and the user may see the value (decision 033 item 9). A display-only field with widget `password` renders the mask `********` instead of its value (decision 037). A display-only boolean renders `BooleanMark` inside `span.readonly` (through `DisplayValue`; decision 039, Q9; Changed 2026-10-08).

### `url.ts`
```ts
export function withQuery(base: string, current: URLSearchParams, changes: Record<string, string | null>): string;
  // copies current, applies changes (null deletes), deletes "p" unless "p" is in changes; "" query → base only
export function sortHref(...): string; // implements the header cycle of decision 013 item 5
```

### `format.ts`
Changed 2026-10-07: rule order is explicit (FK label before number formatting); date-only values use `formatDate` (decision 019).
Changed 2026-10-08: truncation scope fixed to rules 7 and 10 (decision 033 item 15).
Changed 2026-10-08: `formatCell` takes `masked`; password-widget cells render `********` (decision 037 point 5, Q7).
Changed 2026-10-07: date-only strings (PG `date()` string mode) are shown as stored (decision 023).
Changed 2026-10-08: `cellBoolean` added; `formatValue` / `formatCell` unchanged (decision 039).

```ts
export function formatValue(field: FieldMeta, value: unknown, tz: string, t: Messages): string;
  // t: Changed 2026-10-09 (design review, i18n round): only rule 9 uses it (t.binary)
export function formatCell(args: { field: FieldMeta; value: unknown; row: DbRow; tz: string; t: Messages;
  formatter?: (v: unknown, row: DbRow) => string; fkLabel?: string;
  masked?: boolean }): string;   // true for a field whose widget is "password" (decision 037)
export function cellBoolean(args: /* the same argument type as formatCell */): boolean | undefined;
  // returns args.value exactly when rule 4 is the first matching rule of formatCell: not masked,
  // no formatter, value non-null, no fkLabel, typeof value === "boolean"; otherwise undefined
export const TRUNCATE_AT = 100;
```
Rules, applied in this order (first match wins): (0) `masked` → `********`, regardless of the value (null included), the formatter and `fkLabel`, so neither the value nor whether it is set is shown (decision 037 point 5); (1) a formatter → its string as-is (escaped by JSX); (2) null/undefined → `-`; (3) `fkLabel` given (FK field) → `fkLabel`; (4) boolean → `✓` / `✗`; (5) Date and `field.isDateOnly` → `formatDate(value)` (UTC parts, no time zone; decision 019); (6) Date → `formatDateTime(value, tz)`; (7) kind json → `JSON.stringify`; (8) bigint/number → `String`; (9) `Uint8Array`/Buffer → `t.binary` (`[binary]` / `[バイナリ]`; Changed 2026-10-09); (10) other → `String(value)`. Rule 5 applies only to `Date` values. A date-only string (kind string + `isDateOnly`) is not a `Date`, so it falls through to rule 10 and is shown as stored (`2026-10-07`); it is never converted to a `Date` (decision 023). `formatValue` applies rules 2 and 4-10. Truncation: the output of rule 7 (JSON text) and rule 10 (`String(value)`) longer than `TRUNCATE_AT` (100) characters becomes its first 100 characters + `…`; a long JSON value may be cut mid-token. Formatter output (1), `fkLabel` (3), booleans (4), dates (5, 6), numbers (8) and `[binary]` (9) are never truncated (decision 033 item 15).

### Icons (`src/views/icons.tsx`)
Changed 2026-10-08: new section (decision 039, post-v1 enhancement).
Changed 2026-10-08: user answers Q8-Q10: three flash levels only (no `info`); read-only boolean form fields also use `BooleanMark` through `DisplayValue` (Q9); dashboard add/change links get icons and the listed other controls stay text-only (Q10).

```ts
import type { FlashLevel } from "../auth/flash.js";
export type IconName = "plus" | "pencil" | "trash" | "check" | "x" | "search" | "logout"
  | "triangle-alert" | "circle-alert";
export const ICON_PATHS: Readonly<Record<IconName, string>>;          // Object.freeze, values below
export const FLASH_ICONS: Readonly<Record<FlashLevel, IconName>>;     // success → check, warning → triangle-alert, error → circle-alert
export function Icon(props: { name: IconName }): JSX.Element | null;
export function BooleanMark(props: { value: boolean; t: Messages }): JSX.Element;   // t: Changed 2026-10-09, decision 049
```
Not exported from `src/index.ts`; not configurable. `Icon` renders, with every attribute a literal except `data-icon` and `d`:
`<svg class="icon" data-icon={name} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>`.
If `name` is not an own key of `ICON_PATHS` (only possible through a cast), it returns `null`. `aria-hidden="true"` must be a string literal on the `<svg>` element: Biome's recommended `noSvgWithoutTitle` exempts only such decorative SVGs (evidence: 2026-10-08-biome-no-svg-without-title). Hono JSX emits `viewBox` and the kebab-case attributes as written; no `raw()` is used (evidence: 2026-10-08-hono-jsx-inline-svg).
`BooleanMark` renders `<span class="boolean-mark" data-bool={value ? "true" : "false"}><Icon name={value ? "check" : "x"} /><span class="visually-hidden">{value ? t.yes : t.no}</span></span>` (Changed 2026-10-09: `t` prop instead of the `messages` import; `icons.tsx` then imports only types from `messages.ts`).

Security rule: icon names are passed only as literals (or via `FLASH_ICONS`, whose keys are the validated `FlashLevel`); no request, config or DB value selects or builds an icon. Path strings contain only SVG path commands, digits, `.`, `-` and spaces.

| Name | `d` (16×16, stroke) | Used on (existing selector, icon before the text) |
|---|---|---|
| `plus` | `M8 3v10M3 8h10` | `a.addlink` on `DashboardPage` rows and `ListPage`; `button[name=_addanother]` |
| `pencil` | `M10.5 2.5l3 3L6 13H3v-3z` | `a.changelink` on `DashboardPage` rows; `button[name=_continue]` |
| `trash` | `M2.5 4.5h11M6 4.5v-2h4v2M4 4.5l.75 9h6.5l.75-9` | `a.deletelink` on `FormPage`; `DeletePage` submit button; `ConfirmActionPage` submit when `isDelete` |
| `check` | `M3 8.5l3.5 3.5L13 4.5` | `button[name=_save]`; `ConfirmActionPage` submit when not `isDelete`; `BooleanMark` true (list cells and `DisplayValue`); flash `success` |
| `x` | `M4 4l8 8M12 4l-8 8` | `BooleanMark` false (list cells and `DisplayValue`); cancel links on `DeletePage` and `ConfirmActionPage` |
| `search` | `M11.5 7a4.5 4.5 0 1 1-9 0a4.5 4.5 0 1 1 9 0zM10.25 10.25L14 14` | submit button of `form#changelist-search` |
| `logout` | `M6.5 2.5h-4v11h4M10 5l3 3-3 3M13 8H6` | logout button in `#header` |
| `triangle-alert` | `M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.01` | flash `warning` |
| `circle-alert` | `M14 8a6 6 0 1 1-12 0a6 6 0 1 1 12 0zM8 5v3.5M8 11v.01` | flash `error` |

The path data is a reference drawing (not render-checked); the implementer may refine the geometry inside the 16×16 box without changing names, placement or the character rule. No other control gets an icon: the action `run` button, the login button, paginator, filter, breadcrumb and cell links stay text-only (Q10). `BooleanMark` is used in two places: boolean list cells (`Cell.bool`) and read-only boolean form fields, through `DisplayValue` (forms.md; Q9). Because icons contain no text nodes, the text content of every existing link, button and flash item is unchanged. Only boolean values change their text, from `✓` / `✗` to `messages.yes` / `messages.no` (the visually hidden span), both in list cells and in `span.readonly` on the form page. Flash levels stay `success` / `warning` / `error`; there is no `info` level (Q8).

### Static modules
Changed 2026-10-08: `ADMIN_CSS` restyled after DADS values (decision 040); the rules moved to [views-style.md](views-style.md); the exports are unchanged.
Changed 2026-10-08: `SELECT_ALL_SCRIPT_SHA256` added for the Content-Security-Policy (decision 044).
```ts
// src/static/admin-css.ts
export const ADMIN_CSS: string;
export const ADMIN_CSS_VERSION: string; // FNV-1a 32-bit hex of ADMIN_CSS, computed at module load
// src/static/select-all.ts
export const SELECT_ALL_SCRIPT: string;  // must not contain & < > " ' (decision 007)
export const SELECT_ALL_SCRIPT_SHA256: string;
  // base64 SHA-256 of the UTF-8 bytes of SELECT_ALL_SCRIPT, a literal constant (currently
  // "v/peDHOfIZWrfvqqPHbyzhkt2GMZ+0UvE0ARRSfmSAU="); used in `script-src 'sha256-...'` (routes.md, decision 044)
```
The script goes inside `ListPage` as `<script>{SELECT_ALL_SCRIPT}</script>`. Example body:
``const t = document.getElementById(`action-toggle`); if (t) { t.hidden = false; t.addEventListener(`change`, function () { for (const c of document.querySelectorAll(`input[name=_selected]`)) { c.checked = t.checked } }) }``
`#action-toggle` is rendered with the `hidden` attribute, and the script removes it (`t.hidden = false`), so without JS the checkbox does not appear.
The CSP allows the script only by `SELECT_ALL_SCRIPT_SHA256` (decision 044). The hash covers the element's text exactly, which equals `SELECT_ALL_SCRIPT` because the decision 007 character rule means JSX escapes nothing; whoever edits the script must update the constant (a unit test recomputes it with `node:crypto`). Views render no other inline script, no `style` attribute and no inline event handler, and must not add any without changing the policy.

Changed 2026-10-08: the Django-like palette and look are replaced by the DADS-inspired restyle in [views-style.md](views-style.md) (decision 040), which is normative for tokens, rules and focus ring. The structural requirements in the next paragraph still hold.

CSS requirements (§11): no external fonts or URLs; system font stack; a palette defined as CSS custom properties on `:root`, overridden in `@media (prefers-color-scheme: dark)`; header, breadcrumbs and content areas; the filter sidebar on the right (`#changelist-filter`), moved above the table at `max-width: 767px`; the table wrapped in `.results { overflow-x: auto }`; visible styles for `.errornote`, `.errorlist`, `.messagelist .success/.warning/.error`.
Changed 2026-10-08: icon rules (decision 039). Two new custom properties in both `:root` blocks: `--icon-success` and `--icon-warning`.
Changed 2026-10-08: their values (first light `#2e7d32` / `#8a6d00`, dark `#81c784` / `#f5dd5d`, evidence: 2026-10-08-icon-color-contrast) are replaced by the DADS-derived values in [views-style.md](views-style.md) (light `#197a4b` / `#927200`, dark `#71c598` / `#ffc700`; evidence: 2026-10-08-dads-restyle-palette-contrast; decision 040). The rules below stay verbatim; flash items additionally get a 24px icon (views-style.md). Rules (exact selectors; values may be tuned):
```css
.icon { display: inline-block; width: 1em; height: 1em; vertical-align: -0.125em; margin-inline-end: 0.35em; flex-shrink: 0; }
.boolean-mark .icon { margin-inline-end: 0; }
.boolean-mark[data-bool=true], .messagelist .success .icon { color: var(--icon-success); }
.boolean-mark[data-bool=false], .messagelist .error .icon { color: var(--error-fg); }
.messagelist .warning .icon { color: var(--icon-warning); }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```
Every other icon takes `currentColor` (link, button, header text). The stylesheet contains no `url(` at all. No media-query rule is needed: icons are 1em inline boxes before existing text, so the 767px layout is unchanged.

## Data formats
- Change link: `${prefix}/${slug}/${encodeURIComponent(pk)}/change/`. FK link: the same pattern with the referenced slug.

## Errors
- Views never throw for data; unknown values are stringified.
