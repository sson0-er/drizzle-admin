---
id: 38-ui-icons
depends_on: [28-fk-reference-view-permission, 32-password-no-echo, 35-test-gaps-forms-views-auth]
status: done
attempts: 0
---
# Task 38: ui-icons

## Goal
Pages show decorative inline SVG icons from a fixed internal set of 9 icons (decision 039, a post-v1 enhancement the user approved):
- Icons sit on the buttons and links listed in views.md "Icons", on the logout button and on each flash item.
- Boolean list cells and read-only boolean form fields render a colored `BooleanMark` (check / x icon plus the visually hidden text `messages.yes` / `messages.no`) instead of the text `✓` / `✗`.
- Every icon is `aria-hidden="true"` and has no text node. It is selected only by a literal name (or `FLASH_ICONS[level]`), never by request, config or DB data.
- Every existing selector and every visible link, button and flash text stays as it is.

## Scope
### Files to touch
- src/views/icons.tsx (new)
- src/views/layout.tsx, src/views/dashboard.tsx, src/views/list.tsx, src/views/form.tsx, src/views/delete.tsx, src/views/confirm-action.tsx
- src/views/format.ts (add `cellBoolean`)
- src/forms/widgets.tsx (`DisplayValue` only)
- src/routes/list.ts (step 4b: set `Cell.bool`)
- src/static/admin-css.ts
- test/icons.test.ts (new)
- test/format.test.ts, test/views.test.ts, test/widgets.test.ts, test/list.test.ts, test/form.test.ts
### Do not touch
- src/messages.ts (no new key: the accessible text reuses `yes` / `no`, and icons have no text)
- src/index.ts (icons are not public API)
- src/views/login.tsx, src/views/error.tsx, src/views/url.ts, src/static/select-all.ts, src/auth/** (import the `FlashLevel` type only)
- The existing behavior of `formatValue` / `formatCell`: they still return `✓` / `✗` for booleans. The existing assertions in test/format.test.ts stay unchanged.
- In `widgets.tsx`: `Widget`, `toFormValue` and the password mask rule of `DisplayValue`
- These controls get no icon: the action `run` button, the login button, the paginator, filter, breadcrumb and cell links (Q10)
- biome.json, package.json, pnpm-lock.yaml, tsconfig*, vitest.config.ts. Do not add a `biome-ignore` comment or turn off any lint rule.
- Every test file not listed under "Files to touch"
- In the listed existing test files, assertions other than the two boolean expectations named in the Definition of Done. Only add new cases.
- docs/** (except this task's History), README.md, CLAUDE.md
- Do not commit.

## Implementation notes
- **`src/views/icons.tsx`**: follow views.md "Icons (`src/views/icons.tsx`)" exactly.
  - Exports: `IconName`, `ICON_PATHS` (`Object.freeze`), `FLASH_ICONS` (`Object.freeze`), `Icon` and `BooleanMark`.
  - Use the path data from the table. You may refine the geometry inside the 16×16 box, but the names stay the same and every path must match `/^[MmLlHhVvAaZz0-9 .-]+$/`.
  - `Icon` renders the `<svg>` from views.md. Every attribute is a literal except `data-icon` and `d`, and `aria-hidden="true"` is written as a string literal on the `<svg>` element itself.
  - `Icon` returns `null` when `name` is not an own key of `ICON_PATHS` (use `Object.hasOwn`).
  - Imports: only `messages` and `type FlashLevel` from `../auth/flash.js`. This keeps `forms/widgets.tsx` → `views/icons.tsx` free of cycles.
  - Do not use `raw()` or `dangerouslySetInnerHTML` (decision 004).
- **Placement** (views.md Icons table; the icon goes before the existing text node inside the same element):
  - `DashboardPage` rows: `a.addlink` gets plus, `a.changelink` gets pencil.
  - `ListPage`: `a.addlink` gets plus. The submit button of `form#changelist-search` gets search.
  - `FormPage`: `_save` gets check, `_addanother` plus, `_continue` pencil, and `a.deletelink` trash.
  - `DeletePage`: the submit button gets trash, the cancel link x.
  - `ConfirmActionPage`: the submit button gets trash when `isDelete` and check otherwise. The cancel link gets x.
  - `Layout`: the logout button gets `<Icon name="logout" />`. Each flash `li` gets `<Icon name={FLASH_ICONS[m.level]} />` before `{m.text}`.
  - Do not change any existing class, id, `name`, `data-*` or `href`.
- **`Cell.bool`** (views.md `ListPage` props): add `bool?: boolean` to `Cell` in `src/views/list.tsx`.
  - When `bool` is set, the `td` renders `<BooleanMark value={bool} />` instead of `text`. When `href` is also set, the mark goes inside the `a`.
  - When `bool` is undefined, the cell renders exactly as it does now.
- **`format.ts` `cellBoolean`** (views.md `format.ts`): it takes the same argument type as `formatCell`.
  - It returns `args.value` exactly when rule 4 is the first rule that matches: not `masked`, no formatter, value non-null, no `fkLabel`, and `typeof value === "boolean"`. Otherwise it returns `undefined`.
  - If you export a named type for the shared argument, record that export in History.
- **`src/routes/list.ts`** (routes-handlers.md List step 4b): call `cellBoolean` with the same arguments as `formatCell`. Set `bool` only when the result is not `undefined`. `text` and `href` are computed as before.
- **`DisplayValue`** (forms.md `widgets.tsx`, last paragraph). Inside `span.readonly`, the first match wins:
  1. widget `password` → `********`;
  2. `typeof value === "boolean"` → `<BooleanMark value={value} />`;
  3. otherwise → `formatValue(...)`. `null` still gives `-`.
- **CSS** (views.md "Static modules", the 2026-10-08 icon paragraph):
  - Add `--icon-success` and `--icon-warning` to the light `:root` block and to the `:root` block inside `@media (prefers-color-scheme: dark)`, with the given values.
  - Add the `.icon`, `.boolean-mark .icon`, `.boolean-mark[data-bool=true]`, `.boolean-mark[data-bool=false]`, `.messagelist .success|.error|.warning .icon` and `.visually-hidden` rules.
  - Add no `url(` and no media query. `ADMIN_CSS_VERSION` changes by itself.
- **Biome**: views.md says `noSvgWithoutTitle` (recommended) exempts an `<svg>` with a literal `aria-hidden="true"` (evidence 2026-10-08-biome-no-svg-without-title, not yet confirmed on 2.5.15). If `pnpm lint` still reports `noSvgWithoutTitle` on the icon `<svg>`, do not change biome.json, add an ignore comment or add a `<title>`. Stop, set the task to blocked and record the exact lint output in History.
- **Tests**: follow test-strategy.md "Icons (decision 039)" (bullets for icons.test.ts, widgets.test.ts, format.test.ts, views.test.ts, CSS, Integration, Regression). Use the parse5 helpers in `test/helpers/html.ts`.
  - The flash and view-only integration cases go into `test/form.test.ts`. It already has the add-then-flash flow (describe "happy path") and an `authors` view-only setup (describe "permissions").
  - Test the `Icon` unknown-name case as: `Icon({ name: "nope" as IconName })` returns `null`, and rendering it inside a wrapper element gives no `svg`.
- CLAUDE.md conventions apply. Record every export or prop that is not in the design in History.

## Definition of Done
- [ ] `src/views/icons.tsx` exports exactly `IconName`, `ICON_PATHS`, `FLASH_ICONS`, `Icon` and `BooleanMark`. `ICON_PATHS` has exactly the 9 keys of views.md. `src/index.ts` is unchanged (`git diff --quiet src/index.ts`).
- [ ] Icons are never built from user data. Every `<Icon` in `src/` has a `name` that is one of: a string literal, a conditional between two string literals (inside `BooleanMark` and `ConfirmActionPage`), or `FLASH_ICONS[<flash level>]` in `layout.tsx`. List the `grep -rn "<Icon" src` output in History. `grep -rnE "raw\(|dangerouslySetInnerHTML" src` finds nothing.
- [ ] The existing selectors and test hooks are unchanged:
  - `git diff src/views src/forms/widgets.tsx` removes or changes no `class`, `id`, `name`, `data-*`, `href` or `action` attribute value of an existing element;
  - in `git diff test/`, the only removed lines are the `✓` assertion in test/widgets.test.ts (`DisplayValue` boolean case) and the `✓` / `✗` assertions in test/list.test.ts ("shows booleans …", whose title may be updated). No other existing test is changed.
- [ ] `git diff src/messages.ts biome.json package.json` is empty, and `git diff src` adds no `biome-ignore` comment.
- [ ] `ADMIN_CSS` contains no `url(` (asserted in test/views.test.ts).
- [ ] Tests: `test/icons.test.ts` (new), as listed in test-strategy.md "Icons":
  - for each of the 9 names, `Icon` renders one `svg` with `class="icon"`, `data-icon=<name>`, `aria-hidden="true"`, `viewBox="0 0 16 16"`, `fill="none"` and `stroke="currentColor"`, and exactly one child `path` whose `d` equals `ICON_PATHS[name]`;
  - the output has no text node and no `style`, `href` or `on*` attribute;
  - every path matches `/^[MmLlHhVvAaZz0-9 .-]+$/`;
  - `ICON_PATHS` and `FLASH_ICONS` are frozen;
  - an unknown name gives `null` and no `svg`;
  - `FLASH_ICONS` maps success → check, warning → triangle-alert and error → circle-alert;
  - `BooleanMark` true gives `span.boolean-mark[data-bool=true]` with `svg[data-icon=check]` and `span.visually-hidden`, whose text is `messages.yes`. False gives `data-bool=false`, `svg[data-icon=x]` and `messages.no`. In both cases `text(mark)` equals the message.
- [ ] Tests: `test/format.test.ts`:
  - `cellBoolean` returns `true` / `false` for boolean values;
  - it returns `undefined` for `masked: true`, with a formatter, for `null` and `undefined`, with an `fkLabel`, and for `1` and `"true"`;
  - the existing `formatCell` `✓` / `✗` assertions still pass unchanged.
- [ ] Tests: `test/widgets.test.ts`:
  - the `DisplayValue` boolean `true` case now expects `messages.yes` instead of `✓`;
  - `DisplayValue` of `true` / `false` contains `span.readonly > span.boolean-mark[data-bool=true|false]` with `svg[data-icon=check|x]` and the hidden `messages.yes` / `messages.no`;
  - `null` on a boolean field gives `-` and no `svg`;
  - a test-built `password`-widget field with value `true` gives `********` and no `svg`.
- [ ] Tests: `test/views.test.ts`, each case of the test-strategy.md "views.test.ts" bullet:
  - `DashboardPage`: plus / pencil, and `text(a)` is unchanged;
  - `ListPage`: addlink plus, search-button search; `bool: true` gives `span.boolean-mark[data-bool=true]` and no `✓` text; `bool: false` gives `data-bool=false`; with `href` the mark is inside the `a`; a cell without `bool` has no `svg`;
  - `FormPage`: `_save` check, `_addanother` plus, `_continue` pencil, `a.deletelink` trash; with `canSave: false` no button icon;
  - `DeletePage`: trash and x;
  - `ConfirmActionPage`: trash / check by `isDelete`, and x;
  - `Layout`: the logout button has the logout icon and its text is still `messages.logout`; for each flash level, the `li` has the `FLASH_ICONS[level]` icon and `text(li).trim()` equals the message;
  - XSS: a flash text and a cell text `<svg onload=alert(1)>` produce no extra `svg` element;
  - every `svg` in every page rendered by these cases has `aria-hidden="true"`;
  - CSS: no `url(`; `--icon-success` and `--icon-warning` in both the light `:root` and the dark media block; `.icon`, `.boolean-mark[data-bool=true]`, `.boolean-mark[data-bool=false]` and `.visually-hidden` rules are present.
- [ ] Tests: `test/list.test.ts`, both dialects:
  - "shows booleans" expects `cells.active` to be `messages.yes` / `messages.no`, and the `td` contains `span.boolean-mark` with `svg[data-icon=check]` / `svg[data-icon=x]`. The `-` null cell and the other assertions are unchanged;
  - with `formatters: { active: () => "on" }`, the cell text is `on` and the cell has no `span.boolean-mark`.
- [ ] Tests: `test/form.test.ts`, both dialects:
  - after a successful add, `li.success` on the next page contains `svg[data-icon=check]`;
  - on the view-only `authors` change page (`permissions: { change: false }`) of an active author, `div.form-row[data-field=active]` contains `span.boolean-mark` with `svg[data-icon=check]`, and its text contains `messages.yes` and not `✓`.
- [ ] `pnpm lint` passes with biome.json unchanged and the recommended `noSvgWithoutTitle` active. If it does not, the task is reported blocked (see Implementation notes), not worked around.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (sections "Icons (`src/views/icons.tsx`)", "Layout and common props", "Pages", "`format.ts`", "Static modules")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md (section "`widgets.tsx`", `DisplayValue` paragraph)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (section "List" step 4b)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/support.md (section "Responsibilities", messages rule note)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Icons (decision 039)"; Integration coverage "List")
- Decisions: docs/orchestraude/decisions/039-ui-icons-inline-svg.md, docs/orchestraude/decisions/004-biome-for-lint.md (no `raw()` / `dangerouslySetInnerHTML`), docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 11)
- Evidence: docs/orchestraude/evidence/2026-10-08-hono-jsx-inline-svg.md, docs/orchestraude/evidence/2026-10-08-biome-no-svg-without-title.md, docs/orchestraude/evidence/2026-10-08-icon-color-contrast.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

### Attempt 1: done
- `pnpm lint` passes with the unchanged biome.json: the recommended `noSvgWithoutTitle` accepts the `<svg aria-hidden="true">` in `Icon` (confirms the evidence on Biome 2.5.15).
- New exports: only the five required in `src/views/icons.tsx` (`IconName`, `ICON_PATHS`, `FLASH_ICONS`, `Icon`, `BooleanMark`) and `cellBoolean` in `src/views/format.ts` (design). `Cell.bool` prop (design). The shared argument type of `formatCell` / `cellBoolean` is a module-private `CellArgs` interface (not exported).
- Path data used as in the views.md table, unchanged.
- `grep -rn "<Icon" src` (the `icons.tsx:17` hit is the `Record<IconName` type, not a use):
  - dashboard.tsx:21 `<Icon name="plus" />`, :28 `<Icon name="pencil" />`
  - list.tsx:82 `<Icon name="plus" />`, :99 `<Icon name="search" />`
  - layout.tsx:45 `<Icon name="logout" />`, :69 `<Icon name={FLASH_ICONS[m.level]} />`
  - icons.tsx:64 `<Icon name={value ? "check" : "x"} />`
  - delete.tsx:20 `<Icon name="trash" />`, :24 `<Icon name="x" />`
  - confirm-action.tsx:44 `<Icon name={isDelete ? "trash" : "check"} />`, :48 `<Icon name="x" />`
  - form.tsx:78 check, :82 plus, :86 pencil, :93 trash (all literals)
- `grep -rnE "raw\(|dangerouslySetInnerHTML" src` finds nothing.
- Test changes to existing tests: only the `✓` assertion in widgets.test.ts, the `✓` / `✗` assertions and the title of "shows booleans" in list.test.ts, and import lines. The list formatter case is a new `describe.each(dialects)("list page boolean formatter")` (one extra database instance per dialect).
- `scripts/verify.sh` passes.
