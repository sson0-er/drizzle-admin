# Interface: routes (page handlers)

Files: `src/routes/dashboard.ts`, `list.ts`, `actions.ts`, `form.ts`, `delete.ts`, `login.ts`.
Middleware, context helpers (`renderPage`, `redirectWithFlash`, `modelOr404`) and the route table are in [routes.md](routes.md). Views and their props are in [views.md](views.md).
Notation: `P` = `prefix`, `M` = resolved model, `U` = current user, `ctx` = `HookCtx` (decision 015), `list URL` = `${P}/${M.slug}/`.

## Rendering pages
Changed 2026-10-08: 200/400 pages use the function form of `renderPage` (decision 027).

Every page below rendered with status 200 or 400 (dashboard, list, confirm-action, add/change form incl. 400 re-render, delete confirmation, login incl. 400 failure) is rendered as `renderPage(c, status, (flash) => Page({ ...chrome(flash), ...props }))`, where the `PageChrome` gets `flash` from the callback argument. This is how the messages set by the preceding 303 (PRG) appear on the next page. Error pages (403/404, 401, 500) never show flash and may pass a ready element or use the synchronous error-page helper. "→ `XPage(...)`, 200" below always means this form.

## Dashboard (`GET ${P}/`)
Models where `can(M, "view", U)`, in registration order → `DashboardPage({ models: [{ slug, label, canAdd }] })`, 200.

## List (`GET /:model/`)
Changed 2026-10-07: custom actions gated by `ACTION_PERMISSION` = `change` (decision 016).

1. `M` or 404; `view` permission or 403.
2. Parse the query (decision 013 item 6):
   - `q`: used only if `M.searchFields.length > 0`.
   - `o`: comma list; each item `-?key`; keep keys in `M.listDisplay`, dedupe. Empty → `M.ordering`; still empty → `[{ key: pk, desc: true }]`.
   - `f_<key>` for `key` in `M.listFilter` only.
   - `p`: integer ≥ 1, else 1.
3. `repo.list(M.meta, { q, searchFields: M.searchFields, filters, ordering, page, perPage: M.listPerPage })`.
4. FK labels (no N+1): for each `key` in `listDisplay` with `foreignKey.slug` and no formatter, collect distinct non-null `String(row[key])`, call `repo.getMany(refModel.meta, values)` once, and map `String(refRow[refPk]) → refModel.toString(refRow)`.
5. Filter choices: boolean → all / `1` yes / `0` no; enum → all + values; kind date or `isDateOnly` (incl. PG `date()` string mode; Changed 2026-10-07, decision 023) → all + today/past7/month/year; FK → all + `repo.options(refModel.meta, { limit: 200, ordering: refModel.ordering, toLabel: refModel.toString })`.
6. Actions offered: `delete_selected` if `can(M, "delete", U)`, plus custom actions if `can(M, ACTION_PERMISSION, U)` (`"change"`, decision 016). Rendered as a dropdown only if there is at least one.
7. `ListPage(...)`, 200. The action form posts to `list URL + current search string` so the redirect can return to the same state.

## Actions (`POST /:model/`)
Changed 2026-10-07: custom actions require `change` (decision 016).

Body: `action`, `_selected` (repeated), optional `_confirm=1`. `back` = list URL + the request's query string.
1. `M` or 404. Selected ids: strings from `_selected` (array or single), deduped. None → warning flash `noSelection`, 303 back.
2. `action === "delete_selected"`:
   - no `delete` permission → 403.
   - no `_confirm` → `rows = repo.getMany(...)` → `ConfirmActionPage({ isDelete: true, items: rows.map(r => ({ pk, label: M.toString(r) })) })`, 200.
   - `_confirm=1` → `rows = repo.getMany(...)`; for each row `await hooks.beforeDelete?.(row, { ...ctx, mode: "delete" })`; a throw → error flash `hookFailed`, 303 back. Then `n = repo.delete(M.meta, pks of rows)` → success flash `deletedMany(n)`, 303 back. DB error → classify → error flash (`dbForeignKey` for foreignKey, else `dbOther`), 303 back.
3. Custom action `a` with `a.name === action`:
   - missing → error flash `unknownAction`, 303 back.
   - no `ACTION_PERMISSION` (`change`) → 403.
   - `a.confirm && !_confirm` → `ConfirmActionPage({ isDelete: false, actionLabel: a.label, items })`, 200.
   - else `result = await a.run({ ids, db, user: U })` → success flash `result?.message ?? actionDone`; a throw → error flash `actionFailed`; 303 back.

## Add (`GET|POST /:model/add/`)
1. `M` or 404; `add` permission or 403.
2. FK choices: for each form FK field with `slug`: `opts = repo.options(refMeta, { limit: 201, ... })` → `opts.length > 200 ? "tooMany" : opts`.
3. GET → `FormPage({ mode: "add", groups, values: {} })`, 200.
4. POST → `validateSubmission({ mode: "add", ... })`. On error → `FormPage` with `values`, `fieldErrors`, `formErrors`, status 400.
5. `data = hooks.beforeSave ? await hooks.beforeSave(data, { ...ctx, mode: "add" }) : data`; a throw → form error `hookFailed`, 400.
6. `row = await repo.create(M.meta, data)`; DB error → form error by class (`dbUnique`, `dbForeignKey`, `dbNotNull`, `dbOther`), 400.
7. `await hooks.afterSave?.(row, { ...ctx, mode: "add" })`; a throw → extra warning flash `afterSaveFailed`.
8. Success flash `added(M.toString(row))`; 303 to: `_addanother` → `${P}/${slug}/add/`; `_continue` → `${P}/${slug}/${enc(pk)}/change/`; otherwise list URL.

## Change (`GET|POST /:model/:pk/change/`)
Changed 2026-10-07: FK choices are computed as in Add step 2 (review finding).

1. `M` or 404; GET needs `view`, POST needs `change` (else 403). `row = repo.get(M.meta, pk)` → 404 if null.
2. FK choices exactly as Add step 2 (GET and POST; `buildFormGroups` needs them for both). `canChange = can(M, "change", U)`; groups with `canChange` (all display-only when false). Save buttons only if `canChange`; delete link only if `can(M, "delete", U)`.
3. GET → values = `toFormValue` of each editable field from `row`, 200.
4. POST → as Add steps 4-7 with `mode: "change"` and `repo.update(M.meta, pk, data)`; `null` → 404.
5. Success flash `changed(...)`; 303 to: `_continue` → the same change URL; `_addanother` → add URL; otherwise list URL.

## Delete (`GET|POST /:model/:pk/delete/`)
Changed 2026-10-07: `DeletePage` props aligned with views.md.

1. `M` or 404; `delete` permission or 403; `row` or 404.
2. GET → `DeletePage({ modelLabel: M.label, objectLabel: M.toString(row), cancelHref: change URL })`, 200.
3. POST → `beforeDelete(row, { mode: "delete", ... })` (a throw → error flash `hookFailed`, 303 list) → `repo.delete(M.meta, [pk])` → success flash `deleted(label)`, 303 list. DB error → error flash (`dbForeignKey` / `dbOther`), 303 to the list URL (§8: return to the list).

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
