# Interface: views, stylesheet (`src/static/admin-css.ts`)

Changed 2026-10-08: new file. Post-v1 restyle closer to the look of the Japanese Digital Agency design system (DADS), using its public token values but our own CSS, markup and selectors (decision 040). It replaces the Django-like palette described in the "CSS requirements" of [views.md](views.md).

Scope: only the string `ADMIN_CSS` changes (and the comment above it). `ADMIN_CSS_VERSION` keeps its FNV-1a definition and changes by itself. No file under `src/views/`, `src/forms/` or `src/messages.ts` changes. Every class, id, `name` and `data-*` hook listed in views.md stays as is, and the decision 039 icon markup is unchanged.
Changed 2026-10-09: that scope statement describes the restyle task (decision 040). The i18n change adds `div.header-tools` and `form.lang-switch` to the header markup (views.md, decision 051) and three rules for them (section "Language switcher" below); every other rule here is unchanged.

## Rules that stay from v1 and decision 039
- No external fonts or URLs: the stylesheet contains no `url(`, `@import`, `@font-face` or `http`.
- Light tokens on the first `:root` block, which comes before any `@media`; dark tokens in `@media (prefers-color-scheme: dark) { :root { ... } }`; the narrow layout in `@media (max-width: 767px)`. Both query strings stay exactly as written (tests search for them).
- `#changelist-filter` on the right, moved above the table (`order: -1`) in the 767px block; `.results { overflow-x: auto; }`.
- The decision 039 icon rules (`.icon`, `.boolean-mark ...`, `.messagelist .success .icon` ..., `.visually-hidden`) stay verbatim. The token names `--icon-success`, `--icon-warning` and `--error-fg` stay; their values change (table below).
- No JavaScript, no transitions or animations.

## Attribution comment
A TypeScript comment directly above `export const ADMIN_CSS` (outside the string, so it is not served), wording to this effect:
`// Colors and sizes are inspired by the public token values of the Digital Agency design system (DADS, @digital-go-jp/design-tokens 2.0.1, MIT). This stylesheet is our own work; it is not part of DADS and is not made or endorsed by the Digital Agency.`
No DADS CSS is pasted; no `dads-` class names; no Digital Agency name or logo in the served CSS or the UI. No README mention (decision 040).

## Tokens
Every custom property is a color, written as lowercase `#rrggbb`. Both `:root` blocks define exactly the same set of names (dark redefines all of them, including the ones with equal values). All other sizes are literals in the rules. The DADS name each value comes from is given for maintenance; contrast of every pair used is in evidence 2026-10-08-dads-restyle-palette-contrast.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--body-bg` | `#ffffff` (white) | `#1a1a1a` (gray-900) | page, header, cards, inputs, outline buttons |
| `--body-fg` | `#333333` (gray-800) | `#f2f2f2` (gray-50) | body text |
| `--heading-fg` | `#1a1a1a` (gray-900) | `#ffffff` | headings, labels, site title, header cells |
| `--body-quiet` | `#666666` (gray-600) | `#b3b3b3` (gray-300) | user name, breadcrumb trail, filter headings, help, result count |
| `--surface-alt` | `#f2f2f2` (gray-50) | `#262626` (own) | zebra rows, module and filter title bars |
| `--border` | `#949494` (gray-420) | `#767676` (gray-536) | row dividers, module, filter and pagination borders (decorative) |
| `--border-strong` | `#666666` (gray-600) | `#999999` (gray-400) | input borders, header-cell underline |
| `--border-hover` | `#1a1a1a` (gray-900) | `#e6e6e6` (gray-100) | input border on hover |
| `--link` | `#00118f` (blue-1000) | `#9db7f9` (blue-300) | links |
| `--link-hover` | `#000071` (blue-1100) | `#c5d7fb` (blue-200) | links on hover |
| `--primary` | `#0017c1` (blue-900) | `#9db7f9` (blue-300) | solid button fill, outline button text, current page |
| `--primary-hover` | `#00118f` (blue-1000) | `#c5d7fb` (blue-200) | solid hover fill, outline hover text |
| `--primary-active` | `#000060` (blue-1200) | `#d9e6ff` (blue-100) | solid active fill |
| `--on-primary` | `#ffffff` | `#000060` (blue-1200) | text on solid buttons and the current page |
| `--primary-tint` | `#c5d7fb` (blue-200) | `#000071` (blue-1100) | outline button and page-link hover fill |
| `--selected-bg` | `#e8f1fe` (blue-50) | `#000071` (blue-1100) | selected filter choice, `tr.selected` |
| `--danger` | `#ce0000` (red-900) | `#ff7171` (red-400) | danger fill and danger outline text |
| `--danger-hover` | `#a90000` (red-1000) | `#ff9696` (red-300) | danger hover |
| `--danger-active` | `#850000` (red-1100) | `#ffbbbb` (red-200) | danger active fill |
| `--on-danger` | `#ffffff` | `#1a1a1a` (gray-900) | text on danger fill |
| `--danger-tint` | `#fdeeee` (red-50) | `#620000` (red-1200) | danger outline hover fill |
| `--error-fg` | `#ce0000` (red-900) | `#ff7171` (red-400) | error text, error borders, error/false icons |
| `--icon-success` | `#197a4b` (green-800) | `#71c598` (green-300) | success icons and flash border |
| `--icon-warning` | `#927200` (yellow-900) | `#ffc700` (yellow-400) | warning icon and flash border |
| `--focus-outline` | `#000000` | `#ffd43d` (yellow-300) | focus ring, outer 4px |
| `--focus-halo` | `#ffd43d` (yellow-300) | `#000000` | focus ring, inner 2px |
| `--focus-fill` | `#ffd43d` | `#ffd43d` | focused link background |
| `--on-focus-fill` | `#000000` | `#000000` | focused link text |

The light `:root` block also sets `color-scheme: light dark;` so native controls (date pickers, scrollbars) follow the scheme.

Error text uses red-900, one step darker than the DADS error red-800 (`#ec0000`, 4.6:1 on white), to keep 5.18:1 on the zebra background (evidence: 2026-10-08-dads-restyle-palette-contrast, 2026-10-08-dads-a11y-focus-contrast).

## Typography
- `body`: `font-family: "Noto Sans JP", "Noto Sans CJK JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 16px; line-height: 1.7; letter-spacing: 0.02em;`. The Noto names only match locally installed fonts; nothing is downloaded. How the fallback faces render at 1.7 is unverified.
- Headings (`h1, h2, h3`): weight 700, line-height 1.5, `--heading-fg`. `#content h1` 28px with letter-spacing 0.01em (24px under 767px). `.module h2` 18px; `#changelist-filter h2` 16px, `h3` 14px in `--body-quiet`.
- Only weights 400 and 700 are used (no 300/600).
- Dense areas (table, filter, paginator, breadcrumbs, user tools): 14px, line-height 1.5.

## Reference rules
Values are normative. Selector lists are written exactly as shown, including the single space before `{`, because tests search for them (test-strategy.md, "Restyle"). Line breaks inside declaration blocks, the order of rules inside a group and merging of identical declarations are free, except for the ordering constraints marked "order".

Base and links:
```css
* { box-sizing: border-box; }
body { margin: 0; background: var(--body-bg); color: var(--body-fg); /* typography above */ }
a { color: var(--link); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
a:hover { color: var(--link-hover); text-decoration-thickness: 3px; }
h1, h2, h3 { color: var(--heading-fg); font-weight: 700; line-height: 1.5; }
```

Header and breadcrumbs (white header, our own design; DADS has none):
```css
#header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 40px; background: var(--body-bg); color: var(--body-fg); border-bottom: 1px solid var(--border); }
.site-title { color: var(--heading-fg); font-size: 20px; font-weight: 700; text-decoration: none; }
.site-title:hover { color: var(--heading-fg); text-decoration: underline; }
.user-tools { display: flex; align-items: center; gap: 16px; font-size: 14px; line-height: 1.5; }
.user-name { color: var(--body-quiet); }
#header form { display: inline; margin: 0; }
.breadcrumbs { padding: 12px 40px 0; font-size: 14px; line-height: 1.5; color: var(--body-quiet); }
.breadcrumbs span { color: var(--body-fg); }
```
The site-title rule uses the class only (no `#header`), so the focus rule below can override its color. The header no longer uses uppercase text. The `›` separator text node takes `--body-quiet`; the current page (`span`) takes `--body-fg`.

Flash messages (DADS notification look: white card, 3px semantic border, 12px radius, icon on the left):
```css
.messagelist { display: grid; gap: 8px; margin: 16px 40px 0; padding: 0; list-style: none; }
.messagelist li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px;
  border: 3px solid var(--border-strong); border-radius: 12px; background: var(--body-bg); color: var(--body-fg); font-weight: 700; }
.messagelist .success { border-color: var(--icon-success); }
.messagelist .warning { border-color: var(--icon-warning); }
.messagelist .error { border-color: var(--error-fg); }
.messagelist .icon { width: 24px; height: 24px; margin: 2px 0 0; }
```
The flash text is `--body-fg` for every level (the error level no longer has red text); the level is carried by the border and the colored icon.

Content, modules, errors:
```css
#content { padding: 24px 40px 40px; }
#content h1 { margin: 0 0 24px; font-size: 28px; letter-spacing: 0.01em; }
.module { margin: 0 0 32px; padding: 0; min-width: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.module h2 { margin: 0; padding: 12px 16px; font-size: 18px; background: var(--surface-alt); border-bottom: 1px solid var(--border); }
.module tr:last-child > * { border-bottom: 0; }
.errornote { margin: 0 0 24px; padding: 12px 16px; border: 3px solid var(--error-fg); border-radius: 12px;
  background: var(--body-bg); color: var(--error-fg); font-weight: 700; }
.errorlist { margin: 0 0 8px; padding: 0; list-style: none; color: var(--error-fg); }
```
`overflow: hidden` on `.module` clips at the rounded corners; every focusable inside a module is at least 8px from its edge (cell padding, form-row padding), so the 6px focus ring is not clipped.

Forms (DADS density: 16px text, 48px controls, 8px radius):
```css
.form-row { padding: 16px; border-bottom: 1px solid var(--border); }
.form-row:last-child { border-bottom: 0; }
.form-row label { display: inline-block; min-width: 200px; padding-top: 10px; vertical-align: top; font-weight: 700; color: var(--heading-fg); }
.readonly { display: inline-block; padding-top: 10px; }
.help { margin: 4px 0 0; font-size: 14px; color: var(--body-quiet); }
input[type=text], input[type=password], input[type=number], input[type=date], input[type=datetime-local], select, textarea {
  min-height: 48px; max-width: 100%; padding: 8px 16px; border: 1px solid var(--border-strong); border-radius: 8px;
  background: var(--body-bg); color: var(--body-fg); font: inherit; }
textarea { min-height: 120px; width: min(100%, 640px); vertical-align: top; }
/* order: after the input rule above (same specificity) */
input:hover, select:hover, textarea:hover { border-color: var(--border-hover); }
/* order: after the hover rule, so an invalid field keeps its red border on hover */
.errorlist + input, .errorlist + select, .errorlist + textarea { border-color: var(--error-fg); }
input[type=checkbox] { width: 20px; height: 20px; margin: 0; vertical-align: middle; accent-color: var(--primary); }
```
The invalid border uses the existing order "`ul.errorlist`, then the input" of `Widget` (forms.md); no `aria-invalid` or `:has()` is needed. No "required" marker is added (Q11 answered: option (a), decision 040).

Buttons. Variants are chosen by existing selectors; no class is added to the markup:

| Variant | Elements (existing selectors) |
|---|---|
| solid (default `button`) | `button[name=_save]`, login submit, `ConfirmActionPage` submit when not delete, and `.object-tools a.addlink` (list "add" link) |
| outline | `#changelist-search button`, `button[name=index]` (run), `button[name=_addanother]`, `button[name=_continue]` |
| text | `#header button` (logout), `.submit-row a:not(.deletelink)` (cancel links on `DeletePage` and `ConfirmActionPage`) |
| danger solid | `#delete-form button[type=submit]`, `form.delete-action button[type=submit]` (`ConfirmActionPage` with `isDelete`; the class is already rendered) |
| danger outline | `a.deletelink` (form page link to the delete page), `button.deletelink` (kept, unused) |

Dashboard `a.addlink` / `a.changelink`, cell links, sort links, filter links and breadcrumbs stay plain links.
```css
button, .button, .object-tools a.addlink {
  display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 8px 24px;
  border: 1px solid var(--primary); border-radius: 8px; background: var(--primary); color: var(--on-primary);
  font: inherit; font-weight: 700; line-height: 1.5; text-decoration: none; cursor: pointer; }
button:hover, .button:hover, .object-tools a.addlink:hover {
  background: var(--primary-hover); border-color: var(--primary-hover); color: var(--on-primary);
  text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
button:active, .button:active, .object-tools a.addlink:active { background: var(--primary-active); border-color: var(--primary-active); }

#changelist-search button, button[name=index], button[name=_addanother], button[name=_continue] {
  background: var(--body-bg); border-color: currentColor; color: var(--primary); }
#changelist-search button:hover, button[name=index]:hover, button[name=_addanother]:hover, button[name=_continue]:hover {
  background: var(--primary-tint); color: var(--primary-hover); }

#header button { min-height: 36px; padding: 4px 8px; border-color: transparent; background: transparent;
  color: var(--link); font-size: 14px; text-decoration: underline; text-underline-offset: 3px; }
#header button:hover { background: transparent; color: var(--link-hover); text-decoration-thickness: 3px; }
.submit-row a:not(.deletelink) { display: inline-flex; align-items: center; min-height: 48px; padding: 8px 16px; font-weight: 700; }

#delete-form button[type=submit], form.delete-action button[type=submit] {
  background: var(--danger); border-color: var(--danger); color: var(--on-danger); }
#delete-form button[type=submit]:hover, form.delete-action button[type=submit]:hover {
  background: var(--danger-hover); border-color: var(--danger-hover); color: var(--on-danger); }
#delete-form button[type=submit]:active, form.delete-action button[type=submit]:active {
  background: var(--danger-active); border-color: var(--danger-active); }
a.deletelink, button.deletelink { display: inline-flex; align-items: center; min-height: 48px; padding: 8px 24px;
  border: 1px solid currentColor; border-radius: 8px; background: var(--body-bg); color: var(--danger); font-weight: 700; text-decoration: none; }
a.deletelink:hover, button.deletelink:hover { background: var(--danger-tint); color: var(--danger-hover); text-decoration: underline; }

.submit-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 24px 0 0; }
.submit-row a.deletelink { margin-inline-start: auto; }
.confirm-text { margin: 0 0 16px; }
ul.objects { margin: 0 0 24px; padding-inline-start: 1.5em; }
```
Solid buttons keep a 1px border in the fill color so the shape stays visible where backgrounds are dropped (forced colors; unverified). DADS has no danger button (evidence: 2026-10-08-dads-html-snippets-repo); the danger styles reuse the DADS button shape with the red hue. The final, irreversible delete is solid; the link that only opens the confirmation page is outline.

Changelist, table (denser than forms), filter, paginator:
```css
.object-tools { display: flex; justify-content: flex-end; gap: 8px; margin: 0 0 16px; padding: 0; list-style: none; }
#changelist { display: flex; align-items: flex-start; gap: 24px; }
#changelist .changelist-form-container { flex: 1 1 auto; min-width: 0; }
#changelist-search, #changelist-form .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 16px; }
#changelist-search input, #changelist-search button, #changelist-form .actions select, #changelist-form .actions button {
  min-height: 40px; padding: 4px 12px; line-height: 1.5; }
#changelist-search input { flex: 1 1 240px; max-width: 480px; }

table { border-collapse: collapse; width: 100%; font-size: 14px; line-height: 1.5; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
thead th { border-bottom: 2px solid var(--border-strong); color: var(--heading-fg); font-weight: 700; white-space: nowrap; }
tbody th { color: var(--heading-fg); font-weight: 700; }
tbody tr:nth-child(even) { background: var(--surface-alt); }
tr.selected { background: var(--selected-bg); }

#changelist-filter { order: 2; flex: 0 0 240px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--body-bg); font-size: 14px; line-height: 1.5; }
#changelist-filter h2 { margin: 0; padding: 8px 12px; font-size: 16px; background: var(--surface-alt);
  border-bottom: 1px solid var(--border); border-radius: 7px 7px 0 0; }
#changelist-filter h3 { margin: 0; padding: 12px 12px 0; font-size: 14px; color: var(--body-quiet); }
#changelist-filter ul { margin: 0; padding: 4px 12px 12px; list-style: none; }
#changelist-filter li { padding: 2px 4px; border-radius: 4px; }
#changelist-filter .selected { background: var(--selected-bg); }
#changelist-filter .selected a { color: var(--body-fg); font-weight: 700; text-decoration: none; }

.paginator { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 16px 0;
  font-size: 14px; line-height: 1.5; color: var(--body-quiet); }
.paginator a, .paginator .this-page { display: inline-flex; align-items: center; justify-content: center;
  min-width: 36px; min-height: 36px; padding: 0 8px; border-radius: 6px; }
.paginator a { border: 1px solid var(--border); text-decoration: none; }
.paginator a:hover { background: var(--primary-tint); color: var(--primary-hover); text-decoration: underline; }
.paginator .this-page { border: 1px solid var(--primary); background: var(--primary); color: var(--on-primary); font-weight: 700; }
.paginator .result-count { margin-inline-start: 8px; }
```
Old header-cell fill (`thead th` background) and the `thead th a` color override are removed; sort links are ordinary underlined links. Table text is 14px with 8px/12px cell padding, denser than the DADS dense table (12px/16px), to keep an admin-like row count (decision 040).

Language switcher (Changed 2026-10-09: new rules for the header markup of decision 051; order: after the `#header button` rules, before the focus ring):
```css
.header-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.lang-switch { font-size: 14px; line-height: 1.5; color: var(--body-quiet); }
#header .lang-switch button[aria-current=true]:not(:focus-visible) { color: var(--body-fg); font-weight: 700; text-decoration: none; }
```
- The switch buttons are `#header button`, so they take the text-button variant and the yellow focus fill like the logout button; no new variant. The `/` between them takes `--body-quiet` from the form.
- The current language is bold `--body-fg` text without underline (`--body-fg` on `--body-bg` is an already verified text pair). Its selector (1,3,1) beats `#header button` and `#header button:hover`; `:not(:focus-visible)` leaves the focus rule below in charge while the button is focused, so the focused current button still gets `--on-focus-fill` on `--focus-fill`.
- `#header` keeps `justify-content: space-between` with two children (the site title and `.header-tools`); at 767px and below the existing `flex-wrap` moves `.header-tools` under the title, so the narrow-screen block needs no new rule.

Focus ring (order: after every other rule, before the media queries):
```css
:focus-visible { outline: 4px solid var(--focus-outline); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus-halo); }
:is(a, #header button):focus-visible { background: var(--focus-fill); color: var(--on-focus-fill); }
:is(a, #header button):focus-visible :is(.icon, .boolean-mark) { color: inherit; }
```
- Light: element, 2px yellow halo, 4px black outline (the DADS ring). Dark: the colors swap (2px black halo, 4px yellow outline), because a black outline on `#1a1a1a` is not visible; outline contrast 12.21:1 on the page and 10.62:1 on zebra rows (evidence: 2026-10-08-dads-restyle-palette-contrast).
- `outline-offset: 2px` and the 2px halo meet, so the halo fills the gap between the element and the outline.
- Every link and the header logout button also fill yellow with black text when focused (DADS does this for text-type controls; we apply it to all links, including the button-styled add and delete links, for one simple rule). The `:is()` list contains an id, so the rule has specificity (1,1,1) and, placed last, overrides every link color rule above, including `#changelist-filter .selected a` (1,1,1) and the colored boolean and icon rules inside a focused link.
- Buttons other than the logout button keep their variant colors and get only the ring.
- No `:focus` fallback and no `outline: none` anywhere.

## Narrow screens (`@media (max-width: 767px)`)
```css
@media (max-width: 767px) {
  #header { padding: 12px 16px; }
  .breadcrumbs { padding-left: 16px; padding-right: 16px; }
  .messagelist { margin-left: 16px; margin-right: 16px; }
  #content { padding: 16px; }
  #content h1 { font-size: 24px; }
  #changelist { flex-direction: column; align-items: stretch; }
  #changelist-filter { order: -1; flex: 0 0 auto; width: 100%; float: none; }
  .form-row label { display: block; min-width: 0; margin-bottom: 4px; padding-top: 0; }
  .readonly { padding-top: 0; }
  .submit-row > * { flex: 1 1 100%; justify-content: center; }
  .submit-row a.deletelink { margin-inline-start: 0; }
  .results { overflow-x: auto; }
}
```
Under 768px the submit-row buttons and links stack at full width.

## Errors
- None at runtime; the stylesheet is a constant. If it fails to load, the page stays usable as unstyled HTML (unchanged).
