# Interface: routes (page handlers)

Files: `src/routes/dashboard.ts`, `list.ts`, `actions.ts`, `form.ts`, `delete.ts`, `login.ts`.
Middleware, context helpers (`renderPage`, `redirectWithFlash`, `modelOr404`) and the route table are in [routes.md](routes.md). Views and their props are in [views.md](views.md).
Notation: `P` = `prefix`, `M` = resolved model, `U` = current user, `ctx` = `HookCtx` (decision 015), `list URL` = `${P}/${M.slug}/`.
Changed 2026-10-08: "`M` or 404" in every handler below is `modelOr404` (routes.md), which also answers 404 for a model on which `U` has none of the four permissions (decision 043). The later "or 403" checks are unchanged and only apply to models the user holds at least one permission on.

## Rendering pages
Changed 2026-10-08: 200/400 pages use the function form of `renderPage` (decision 027).

Every page below rendered with status 200 or 400 (dashboard, list, confirm-action, add/change form incl. 400 re-render, delete confirmation, login incl. 400 failure) is rendered as `renderPage(c, status, (flash) => Page({ ...chrome(flash), ...props }))`, where the `PageChrome` gets `flash` from the callback argument. This is how the messages set by the preceding 303 (PRG) appear on the next page. Error pages (403/404, 401, 500) never show flash and may pass a ready element or use the synchronous error-page helper. "→ `XPage(...)`, 200" below always means this form.

## Dashboard (`GET ${P}/`)
Models where `can(M, "view", U)`, in registration order → `DashboardPage({ models: [{ slug, label, canAdd }] })`, 200.

## List (`GET /:model/`)
Changed 2026-10-07: custom actions gated by `ACTION_PERMISSION` = `change` (decision 016).
Changed 2026-10-08: FK labels, links and filters require `view` on the referenced model (decision 034); `listDisplayLinks` wins over the FK link and an FK filter value outside the offered choices is accepted (decision 033 items 4, 5); column headers and filter headings stay the raw key (decision 035); `sort` reflects only an explicit `o` (decision 033 item 8).
Changed 2026-10-08: FK filter choices use `defaultOrdering(ref)`, so an unordered referenced model is sorted by primary key descending, not ascending (decision 013 item 7, L083).
Changed 2026-10-08: `password`-widget columns are not sortable (`o` drops their key, header `sortHref: null`) and a masked cell gets no FK link (decision 037 point 6, L011, L010).

Notation: for an FK field with `foreignKey.slug`, `ref` = `state.models.get(slug)` and `refVisible` = `can(ref, "view", U)`. For any resolved model `R`, `defaultOrdering(R)` = `R.ordering` when non-empty, otherwise `[{ key: R.meta.pk.key, desc: true }]` (primary key descending; decision 013 items 4 and 7). The list page ordering without `o` (step 2), the FK filter choices (step 5) and the FK select choices (Add step 2, Change) all use it, so the 200-row cap picks the same rows the referenced model's own list page shows first. Whether this is a shared helper or an inline expression is an implementation choice.

1. `M` or 404; `view` permission or 403.
2. Parse the query (decision 013 item 6):
   - `q`: used only if `M.searchFields.length > 0`. Changed 2026-10-08 (decision 045): normalized as `Array.from(raw.replaceAll("\u0000", "").trim()).slice(0, 200).join("")` where `raw = params.get("q") ?? ""` (NUL characters removed, trimmed, cut to 200 code points; `SEARCH_MAX_LENGTH = 200`, module-private). The normalized value is passed to `repo.list` and to `ListPage` as `q` (the search box echoes it). An empty result means no search.
   - `o`: comma list; each item `-?key`; keep keys in `M.listDisplay` whose widget is not `password` (`M.widgets[key] !== "password"`), dedupe. A `password` key is dropped silently, like any other unknown key; the remaining keys still apply (decision 037 point 6). Empty → `defaultOrdering(M)` (`M.ordering`; still empty → `[{ key: pk, desc: true }]`).
   - `f_<key>` for `key` in `M.listFilter` only; an empty value is ignored. For an FK filter with `!refVisible` the parameter is ignored (not passed to `repo.list`), because that filter is not offered (step 5; decision 034).
   - `p`: integer ≥ 1, else 1.
3. `repo.list(M.meta, { q, searchFields: M.searchFields, filters, ordering, page, perPage: M.listPerPage })`.
4. FK labels (no N+1): for each `key` in `listDisplay` with `foreignKey.slug`, no formatter and `refVisible`, collect distinct non-null `String(row[key])`, call `repo.getMany(refModel.meta, values)` once, and map `String(refRow[refPk]) → refModel.toString(refRow)`. With `!refVisible` no query runs for that column (decision 034).
   4b. Cells: `masked = M.widgets[key] === "password"`, computed once per column; `text = formatCell(...)` with `fkLabel` only when step 4 loaded one, and `masked` (the cell shows `********`; decision 037 point 5, Changed 2026-10-08). `href`, first match: the column is in `listDisplayLinks` → the row's own change page (this wins even for an FK column; decision 033 item 4); FK column with `refVisible`, not `masked` (Changed 2026-10-08, decision 037 point 6: defense in depth, since `register()` already rejects `password` on FK columns), no formatter and a non-null value → `${P}/${refSlug}/${enc(value)}/change/`; otherwise none. So with `!refVisible` an FK cell shows the raw value without a link or label (decision 034). Changed 2026-10-08: the cell also gets `bool = cellBoolean(<the same arguments as formatCell>)` when that is not `undefined`, so `ListPage` renders the boolean icon with its accessible text (decision 039); `text` and `href` are computed as before.
5. Filter choices: boolean → all / `1` yes / `0` no; enum → all + values; kind date or `isDateOnly` (incl. PG `date()` string mode; Changed 2026-10-07, decision 023) → all + today/past7/month/year; FK with `refVisible` → all + `repo.options(ref.meta, { limit: 200, ordering: defaultOrdering(ref), toLabel: ref.toString })` (the referenced model's `ordering`, or primary key descending when it has none; decision 013 item 7); FK with `!refVisible` → the filter is omitted (no sidebar section, no query; decision 034).
   The selected choice is the one whose value equals the active `f_<key>`; when none matches, "all" is marked selected. For boolean, enum and date filters a non-matching value is also ignored by `buildFilters`, so "all" is accurate. For an FK filter, a valid key that is not among the 200 offered choices still filters the rows while "all" is marked selected; this is accepted (decision 033 item 5). Code comments must not claim that the repository ignores such FK values.
6. Actions offered: `delete_selected` if `can(M, "delete", U)`, plus custom actions if `can(M, ACTION_PERMISSION, U)` (`"change"`, decision 016). Rendered as a dropdown only if there is at least one.
7. `ListPage(...)`, 200. `columns[i] = { key, sort, sortHref }`; headers and filter headings show the key (decision 035). `sort` is `asc`/`desc` only for keys in the explicit `o` parameter; with the default ordering every column is `none` (decision 033 item 8). `sortHref` is `sortHref(...)` (views.md `url.ts`), except for a column whose widget is `password`: `sort: "none"` and `sortHref: null`, so its header has no sort link (decision 037 point 6, Changed 2026-10-08). The action form posts to `list URL + current search string` so the redirect can return to the same state.

## Actions (`POST /:model/`)
Changed 2026-10-07: custom actions require `change` (decision 016).
Changed 2026-10-08: both `ConfirmActionPage` renders pass `listHref` and `backQuery` (decision 031).
Changed 2026-10-08: no surviving rows → `noSelection` warning for `delete_selected` (recorded, decision 033 item 3) and for the custom-action confirmation step (decision 036).

Body: `action`, `_selected` (repeated), optional `_confirm=1`. `listUrl` = `${prefix}/${M.slug}/`; `backQuery` = the request's query string (leading `?`, or `""`); `back` = `listUrl + backQuery`.
Every `ConfirmActionPage` render below passes `modelLabel: M.label`, `action` (the submitted value), `listHref: listUrl` and `backQuery`, plus the props listed in its step.
1. `M` or 404. Selected ids: strings from `_selected` (array or single), deduped. None → warning flash `noSelection`, 303 back. Changed 2026-10-08 (decision 045): more than `MAX_SELECTED` ids (`export const MAX_SELECTED = 500` in `src/routes/actions.ts`; exported because `register()` caps `listPerPage` with the same constant, admin.md; design review, security-audit fix round) → warning flash `messages.tooManySelected(500)`, 303 back, with no DB query and no `run`. Both checks run before the action lookup and the permission checks below. Ids that `parsePk` rejects (e.g. out of the column's integer range, data.md) are dropped by `getMany` / `delete`, so they act like vanished rows.
2. `action === "delete_selected"`:
   - no `delete` permission → 403.
   - `rows = repo.getMany(...)` (both steps). `rows` empty (every selected row vanished) → warning flash `noSelection`, 303 back (decision 033 item 3).
   - no `_confirm` → `ConfirmActionPage({ isDelete: true, actionLabel: messages.deleteSelected, items: rows.map(r => ({ pk, label: M.toString(r) })), listHref: listUrl, backQuery })`, 200.
   - `_confirm=1` → for each row `await hooks.beforeDelete?.(row, { ...ctx, mode: "delete" })`; a throw → error flash `hookFailed`, 303 back. Then `n = repo.delete(M.meta, pks of rows)` → success flash `deletedMany(n)`, 303 back. DB error → classify → error flash (`dbForeignKey` for foreignKey, else `dbOther`), 303 back.
3. Custom action `a` with `a.name === action`:
   - missing → error flash `unknownAction`, 303 back.
   - no `ACTION_PERMISSION` (`change`) → 403.
   - `a.confirm && !_confirm` → `rows = repo.getMany(...)`; `rows` empty → warning flash `noSelection`, 303 back (decision 036); else `ConfirmActionPage({ isDelete: false, actionLabel: a.label, items: rows.map(...), listHref: listUrl, backQuery })`, 200.
   - else `result = await a.run({ ids, db, user: U })` → success flash `result?.message ?? actionDone`; a throw → error flash `actionFailed`; 303 back.

## Add (`GET|POST /:model/add/`)
Changed 2026-10-08: every `FormPage` render passes `timeZone: state.config.timeZone` (decision 030).
Changed 2026-10-08: FK choices need `view` on the referenced model (decision 034); non-DB errors from `repo.create` are 500s (decision 033 item 10).
Changed 2026-10-08: FK choices are ordered by `defaultOrdering(ref)` (decision 013 item 7, L083).

1. `M` or 404; `add` permission or 403.
2. FK choices: for each form FK field with `slug` (`ref` = its registered model): `!can(ref, "view", U)` → `"noView"` without a query (decision 034); otherwise `opts = repo.options(ref.meta, { limit: 201, ordering: defaultOrdering(ref), toLabel: ref.toString })` → `opts.length > 200 ? "tooMany" : opts`. `defaultOrdering` is defined in the List notation: the referenced model's `ordering`, or primary key descending when it has none (decision 013 item 7).
3. GET → `FormPage({ mode: "add", groups, values: {}, timeZone })`, 200. `timeZone` is always `state.config.timeZone` (the resolved `AdminConfig.timeZone`, admin.md `AdminState`); the same value is passed to `validateSubmission` and `toFormValue`. No `displayRow` (add has no stored row and no display-only fields, forms.md).
4. POST → `validateSubmission({ mode: "add", ... })`. On error → `FormPage` with `values` (echoed request strings), `fieldErrors`, `formErrors`, `timeZone`, status 400.
5. `data = hooks.beforeSave ? await hooks.beforeSave(data, { ...ctx, mode: "add" }) : data`; a throw → form error `hookFailed`, 400.
6. `row = await repo.create(M.meta, data)`; DB error (`isDbError`) → form error by class (`dbUnique`, `dbForeignKey`, `dbNotNull`, `dbOther`), 400. Any other error (including `create`'s "returned no row" error, data.md) is rethrown and becomes a 500 through `onError`, logged in full (decisions 022, 033 item 10).
7. `await hooks.afterSave?.(row, { ...ctx, mode: "add" })`; a throw → extra warning flash `afterSaveFailed`.
8. Success flash `added(M.toString(row))`; 303 to: `_addanother` → `${P}/${slug}/add/`; `_continue` → `${P}/${slug}/${enc(pk)}/change/`; otherwise list URL.

## Change (`GET|POST /:model/:pk/change/`)
Changed 2026-10-07: FK choices are computed as in Add step 2 (review finding).
Changed 2026-10-08: `FormPage` gets `displayRow: row` and `timeZone: state.config.timeZone` on GET and on the 400 re-render (decision 030).
Changed 2026-10-08: `password` fields render empty and an empty submission keeps the stored value (decision 037); non-DB errors from `repo.update` are 500s (decision 033 item 10).

1. `M` or 404; GET needs `view`, POST needs `change` (else 403). `row = repo.get(M.meta, pk)` → 404 if null (also for a `pk` outside the column's domain, which `parsePk` rejects without a query; decision 045).
2. FK choices exactly as Add step 2 (GET and POST; `buildFormGroups` needs them for both). `canChange = can(M, "change", U)`; groups with `canChange` (all display-only when false). Save buttons only if `canChange`; delete link only if `can(M, "delete", U)`.
3. GET → `FormPage({ mode: "change", groups, values, displayRow: row, timeZone, canSave: canChange, deleteHref? })` with `values` = `toFormValue(field, row[key], timeZone)` of each editable field, 200.
4. POST → as Add steps 4-7 with `mode: "change"` and `repo.update(M.meta, pk, data)`; `null` → 404. As in Add step 6, only DB errors become form errors; others are rethrown (500). An editable `password`-widget field submitted empty is absent from `data` (forms.md), so `update` keeps its stored value; its input always renders empty, also on the 400 re-render (decision 037). The 400 re-render passes the echoed request strings as `values` and the stored `row` (from step 1) as `displayRow`, plus `timeZone`.
5. Success flash `changed(...)`; 303 to: `_continue` → the same change URL; `_addanother` → add URL; otherwise list URL.

## Delete (`GET|POST /:model/:pk/delete/`)
Changed 2026-10-07: `DeletePage` props aligned with views.md.
Changed 2026-10-08: 0 deleted rows → warning `alreadyDeleted` instead of the success flash (decision 036).

1. `M` or 404; `delete` permission or 403; `row` or 404.
2. GET → `DeletePage({ modelLabel: M.label, objectLabel: M.toString(row), cancelHref: change URL })`, 200.
3. POST → `beforeDelete(row, { mode: "delete", ... })` (a throw → error flash `hookFailed`, 303 list) → `n = repo.delete(M.meta, [pk])` → `n > 0`: success flash `deleted(label)`, 303 list; `n === 0` (the row vanished after step 1, e.g. a concurrent delete): warning flash `alreadyDeleted(label)`, 303 list (decision 036). DB error → error flash (`dbForeignKey` / `dbOther`), 303 to the list URL (§8: return to the list).

## Login (`GET|POST /login/`, builtin only)
- GET: if `user` is already set → 302 to `safeNext(query.next, P)`. Otherwise `LoginPage({ next: query.next ?? "", username: "" })`, 200.
- POST: `username`, `password`, `next` from the body. `verifyCredentials(username, password)`:
  - user → `writeSession(newSession(user, now))` (new token), 303 to `safeNext(next, P)`.
  - null → `LoginPage({ error: loginFailed, username, next })`, 400. The password is never echoed.
  - a throw → 500 through `onError`.

## Logout (`POST /logout/`, builtin only)
`clearSession` → 303 to `${P}/login/`.

## Conventions
Changed 2026-10-07: `HookCtx` fixed (decision 015).

- `enc(pk)` = `encodeURIComponent(String(pk))`. Route `:pk` is used as received from `c.req.param("pk")` (Hono decoding of reserved characters unverified; tests use numeric and UUID keys).
- `ctx` for hooks = `{ mode, user: U, db: state.config.db }` (`HookCtx`, decision 015). `mode` is `"add"` / `"change"` for `beforeSave` / `afterSave` and `"delete"` for `beforeDelete`.
- Every successful POST ends in a 303 (PRG). Every rendered error page uses the layout (Origin-check 403 included; routes.md "Error handling").
