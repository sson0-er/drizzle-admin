# Interface: views

Files: `src/views/{layout,dashboard,list,form,delete,confirm-action,login,error}.tsx`, `src/views/format.ts`, `src/views/url.ts`, `src/static/admin-css.ts`, `src/static/select-all.ts`.
All components are synchronous Hono JSX functions (`hono/jsx`). Escaping comes only from Hono JSX: `raw()` and `dangerouslySetInnerHTML` are forbidden (Biome rule, decision 004). Texts come from `messages` ([support.md](support.md)). Widgets come from [forms.md](forms.md).

## Responsibilities
- Render every page from plain props (no DB access, no Context).
- Format list cell values.
- Provide the stylesheet string and the select-all script.

## API

### Layout and common props
```ts
interface PageChrome {
  siteTitle: string; prefix: string; title: string;
  user: AdminUser | null; showLogout: boolean;        // builtin mode and logged in
  csrfToken: string; flash: FlashMessage[];
  breadcrumbs: { label: string; href?: string }[];    // first item is always Home → `${prefix}/`
}
export function Layout(props: PageChrome & { children: Child }): JSX.Element;
```
Structure: `<html lang="ja">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>{title} | {siteTitle}</title>`, `<link rel="stylesheet" href={`${prefix}/static/admin.css?v=${ADMIN_CSS_VERSION}`}>`; `<header id="header">` with the site title link and, if `user`, the user name and (if `showLogout`) `<form method="post" action={`${prefix}/logout/`}>` with the CSRF hidden input; `<nav class="breadcrumbs">`; `<ul class="messagelist">` with `<li class={level}>`; `<main id="content">`.
Every POST form contains `<input type="hidden" name="_csrf" value={csrfToken}>`.

### Pages (all take `PageChrome` plus the listed props)
| Component | Extra props | Stable selectors used by tests |
|---|---|---|
| `DashboardPage` | `models: { slug; label; canAdd }[]` | `table#dashboard`, row `tr[data-model=<slug>]` with `a.changelink` (list) and `a.addlink` (add, only if canAdd) |
| `ListPage` | see below | `form#changelist-search` (GET; `input[name=q]`), `aside#changelist-filter` with `div[data-filter=<key>]` containing `a` links and `.selected` on the active choice, `form#changelist-form` (POST), `select[name=action]`, `button[name=index]` ("run"), `table#result_list`, `th[data-key=<key>]` with a sort link `a.sort` and `data-sort="asc|desc|none"`, `input[name=_selected][value=<pk>]`, `input#action-toggle` (select all), `p.paginator` with `span.this-page` and `.result-count`, `a.addlink` |
| `FormPage` | `mode; modelLabel; groups: FormGroup[]; values; fieldErrors; formErrors; canSave; deleteHref?; displayRow?` | `form#model-form` (POST), `fieldset.module` per group (`h2` for the title), `div.form-row[data-field=<key>]`, `p.errornote` (shown when there are any errors), `ul.errorlist`, buttons `button[name=_save]`, `button[name=_addanother]`, `button[name=_continue]`, `a.deletelink` |
| `DeletePage` | `modelLabel; objectLabel; cancelHref` | `form#delete-form`, `p.confirm-text`, `button[type=submit]` |
| `ConfirmActionPage` | `modelLabel; action: string; actionLabel; isDelete; items: { pk; label }[]; backQuery: string` | `form#action-confirm` (POST to list URL + backQuery) with hidden `action`, `_confirm=1`, one hidden `_selected` per item, `ul.objects li` |
| `LoginPage` | `next; username; error?` | `form#login-form` (POST `${prefix}/login/`), `input[name=username]`, `input[name=password]`, hidden `next`, `p.errornote` |
| `ErrorPage` | `status; message` | `h1`, `p.error-message` |

`ListPage` props:
```ts
{
  model: { slug; label }; columns: { key; sort: "asc" | "desc" | "none"; sortHref: string }[];
  rows: { pk: string; cells: Cell[] }[];
  // Cell = { text: string; href?: string } ; href for listDisplayLinks (change page) or FK links
  q?: string | null;  // null → hide the search box
  filters: { key: string; choices: { label: string; href: string; selected: boolean }[] }[];
  actions: { name: string; label: string }[]; canAdd: boolean;
  page: number; pages: number; total: number; pageHref: (n: number) => string; backQuery: string;
}
```
Pagination shows previous/next and up to 5 numbers around the current page, plus `messages.resultCount(total)`. JS-free: every control is a link or a form submit. Only `#action-toggle` needs JS.

### `url.ts`
```ts
export function withQuery(base: string, current: URLSearchParams, changes: Record<string, string | null>): string;
  // copies current, applies changes (null deletes), deletes "p" unless "p" is in changes; "" query → base only
export function sortHref(...): string; // implements the header cycle of decision 013 item 5
```

### `format.ts`
Changed 2026-10-07: rule order is explicit (FK label before number formatting); date-only values use `formatDate` (decision 019).
Changed 2026-10-07: date-only strings (PG `date()` string mode) are shown as stored (decision 023).

```ts
export function formatValue(field: FieldMeta, value: unknown, tz: string): string;
export function formatCell(args: { field: FieldMeta; value: unknown; row: DbRow; tz: string;
  formatter?: (v: unknown, row: DbRow) => string; fkLabel?: string }): string;
export const TRUNCATE_AT = 100;
```
Rules, applied in this order (first match wins): (1) a formatter → its string as-is (escaped by JSX); (2) null/undefined → `-`; (3) `fkLabel` given (FK field) → `fkLabel`; (4) boolean → `✓` / `✗`; (5) Date and `field.isDateOnly` → `formatDate(value)` (UTC parts, no time zone; decision 019); (6) Date → `formatDateTime(value, tz)`; (7) kind json → `JSON.stringify`; (8) bigint/number → `String`; (9) `Uint8Array`/Buffer → `[binary]`; (10) other → `String(value)`. Rule 5 applies only to `Date` values. A date-only string (kind string + `isDateOnly`) is not a `Date`, so it falls through to rule 10 and is shown as stored (`2026-10-07`); it is never converted to a `Date` (decision 023). `formatValue` applies rules 2 and 4-10. Default-formatted strings longer than 100 chars → first 100 + `…`.

### Static modules
```ts
// src/static/admin-css.ts
export const ADMIN_CSS: string;
export const ADMIN_CSS_VERSION: string; // FNV-1a 32-bit hex of ADMIN_CSS, computed at module load
// src/static/select-all.ts
export const SELECT_ALL_SCRIPT: string;  // must not contain & < > " ' (decision 007)
```
The script goes inside `ListPage` as `<script>{SELECT_ALL_SCRIPT}</script>`. Example body:
``const t = document.getElementById(`action-toggle`); if (t) { t.hidden = false; t.addEventListener(`change`, function () { for (const c of document.querySelectorAll(`input[name=_selected]`)) { c.checked = t.checked } }) }``
`#action-toggle` is rendered with the `hidden` attribute, and the script removes it (`t.hidden = false`), so without JS the checkbox does not appear.

CSS requirements (§11): no external fonts or URLs; system font stack; a Django-like palette defined as CSS custom properties on `:root`, overridden in `@media (prefers-color-scheme: dark)`; header, breadcrumbs and content areas; the filter sidebar on the right (`#changelist-filter`), moved above the table at `max-width: 767px`; the table wrapped in `.results { overflow-x: auto }`; visible styles for `.errornote`, `.errorlist`, `.messagelist .success/.warning/.error`.

## Data formats
- Change link: `${prefix}/${slug}/${encodeURIComponent(pk)}/change/`. FK link: the same pattern with the referenced slug.

## Errors
- Views never throw for data; unknown values are stringified.
