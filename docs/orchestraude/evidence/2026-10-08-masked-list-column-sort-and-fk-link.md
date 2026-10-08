---
id: 2026-10-08-masked-list-column-sort-and-fk-link
question: For L010/L011 (decision 037 point 6), can a password-widget column be sorted or FK-linked in the list, and can the password widget sit on an FK column?
source: repository code at commit 69cd72b (src/forms/fields.ts allowedWidgets, src/routes/list.ts parseOrdering and cell loop, src/views/list.tsx header)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `allowedWidgets` returns `select`, `number`/`text`, `hidden` for any field with `foreignKey` (first branch), so `register()` rejects `password` on an FK column; `password` is offered only for kind string without `isDateOnly`. A masked FK cell is therefore unreachable through the public API.
- `parseOrdering(params.get("o"), model.listDisplay)` accepts every `listDisplay` key, so `?o=<password key>` sorts rows by the stored value (NULL vs set grouping, and value order, are observable).
- The FK-link condition in the cell loop does not check `masked`; it only skips null values and formatter/hidden-FK columns.
- `ListPage` renders every header as `a.sort` with `href={c.sortHref}` (src/views/list.tsx).
- `register()` checks `searchFields` kinds (string/enum) and `ordering` keys exist, but not their widget; a string primary key may use `password`.
Not confirmed: nothing was run; facts come from reading the code.
