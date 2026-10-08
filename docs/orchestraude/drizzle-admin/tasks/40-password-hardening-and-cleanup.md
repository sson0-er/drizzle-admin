---
id: 40-password-hardening-and-cleanup
depends_on: [36-readme-and-hardening, 38-ui-icons]
status: pending
attempts: 0
---
# Task 40: password-hardening-and-cleanup

## Goal
Follow-up to `06-low-findings-followup-triage.md` (A items L010, L014, L001, L007; B item L011) and decision 037 points 6 and 7 (Q12):
- A list column whose widget is `password` cannot be sorted. Its header shows the key as plain text with no `a.sort` and `data-sort="none"`, and `?o=` silently drops that key while the other keys in the same `o` still apply (L011).
- A masked list cell never gets the FK auto-link (L010, defense in depth).
- `register()` throws for a `password` widget on the primary key, on a field in `searchFields`, or on a field in `ordering` (either direction), with the exact messages of admin.md step 5 (Q12).
- README: the external-mode wording is accurate (L014), section 6 lists the `password` restrictions of `register()`, and section 9 says that a `password` column cannot be sorted.
- `formatCell` and `cellBoolean` take the rule 0-3 precedence (masked, formatter, null, `fkLabel`) from one module-private helper (L001). Behavior does not change.
- `Icon` keeps its `Object.hasOwn` guard, and the comment above it gives the reason (L007, planner decision below).

## Scope
### Files to touch
- src/admin.ts (`resolveModel`: the password checks after the `allowedWidgets` loop)
- src/routes/list.ts (`listHandler`: `o` parsing, the FK-link condition, `columns`)
- src/views/list.tsx (`ListPageProps.columns[].sortHref: string | null` and the header rendering)
- src/views/format.ts (shared precedence helper)
- src/views/icons.tsx (only the comment above the `Object.hasOwn` guard)
- README.md (sections "Configuration reference", "Model options reference", "Authentication modes and security", "Behavior notes")
- test/register.test.ts, test/views.test.ts, test/password-widget.test.ts, test/format.test.ts (add cases only)

This task touches 10 files (more than the usual 1-5). The orchestrator asked for this batching, and each change is small.

### Do not touch
- src/forms/** (`allowedWidgets` already rejects `password` on FK columns; no change), src/views/url.ts (`sortHref` itself is unchanged), src/types.ts, src/index.ts, src/messages.ts (register errors are `fail(...)` literals, not UI messages)
- The exported signatures of `formatValue`, `formatCell`, `cellBoolean` and `TRUNCATE_AT`, and the call sites of `formatCell` / `cellBoolean` in src/routes/list.ts
- The behavior of `Icon`: it still returns `null` for a name that is not an own key of `ICON_PATHS`
- test/icons.test.ts, test/readme.test.ts, test/list.test.ts, test/auth.test.ts and every other test file not listed under "Files to touch"
- Existing assertions in the listed test files: add new cases only (see Definition of Done)
- docs/** (except this task's History), CLAUDE.md, docs/orchestraude/review-policy.md
- biome.json, package.json, pnpm-lock.yaml, tsconfig*, vitest.config.ts
- Do not commit.

## Implementation notes
- **Masked columns in `listHandler`** (routes-handlers.md List steps 2, 4b and 7):
  - Decide per column whether a key is masked (`model.widgets[key] === "password"`), once, outside the row loop. A module-private helper or a `Set` of masked keys is fine. Use that one source for all three places below, so they cannot disagree.
  - Step 2: `parseOrdering` gets only the `listDisplay` keys that are not masked. A masked key in `o` is dropped like an unknown key. No error, no flash.
  - Step 4b: pass the same value as `masked` to `formatCell` / `cellBoolean` as now. Add `!masked` to the FK-link condition. The `listDisplayLinks` branch stays first and still links masked cells to the row's own change page (decision 037 point 6).
  - Step 7: a masked column gets `{ key, sort: "none", sortHref: null }`. Other columns are unchanged.
- **`ListPage`** (views.md "Pages" `ListPage` props): `columns[].sortHref: string | null`. When it is `null`, the `th[data-key][data-sort]` contains only the key as text, with no `a.sort`. When it is a string, the output is unchanged.
- **`register()` password checks** (admin.md `register` step 5, second paragraph): run them after the existing `allowedWidgets` loop. For each `widgets` entry whose value is `"password"`, check in this order and throw the first that applies (`fail` adds the `drizzle-admin: ` prefix):
  1. `key === meta.pk.key` → `<table>: the primary key "<key>" cannot use the password widget`
  2. `key` is in `searchFields` → `<table>: field "<key>" uses the password widget and cannot be in searchFields`
  3. `key` is in `ordering`, as `key` or `-key` (use the parsed `ordering` items) → `<table>: field "<key>" uses the password widget and cannot be in ordering`
  `<table>` is `meta.tableName`, the same `name` the other register errors use. Only explicit `widgets` entries count.
- **L001, `format.ts`** (views.md "`format.ts`"): write one module-private helper that encodes the rule 0-3 precedence (masked → formatter → null/undefined → `fkLabel`). Both `formatCell` and `cellBoolean` must use it, and neither may keep its own copy of those four conditions.
  - `cellBoolean` must not call the formatter. Today it does not, and a user formatter must not run twice per cell.
  - One way that satisfies this: the helper returns which of rules 0-3 matches first (or `undefined`), without calling the formatter. `formatCell` maps the result to its text, and `cellBoolean` returns the value only when the result is `undefined` and `typeof value === "boolean"`.
  - CLAUDE.md conventions apply: if the type system cannot see that `formatter` / `fkLabel` is set after the helper's answer, use a non-null assertion with a short why-comment, not a re-check.
  - Keep `CellArgs` module-private.
- **L007, planner decision: keep the guard.** CLAUDE.md says not to keep guards that the types already rule out, but it also says that a change departing from the design needs a decision record first.
  - views.md "Icons" requires `Icon` to return `null` for a name that is not an own key of `ICON_PATHS`.
  - test/icons.test.ts pins it for `"nope"` and for the inherited `"toString"`.
  - `ICON_PATHS[name]` with an inherited key would render a function's source into `d`.
  - So the guard is a real boundary (a cast at a call site). Rewrite only the comment so that it states this reason and cites views.md / decision 039. Change no code line.
- **README** (project-setup.md README outline, sections 5, 6, 8 and 9):
  - Section 8, "External authentication" paragraph (L014). `getUser` is called on every page request: `<basePath>/static/admin.css` is served before user resolution, so it is not called for the stylesheet (src/routes/index.ts registers the static route before `userMiddleware`). Write:
    - for a logged-in user, `GET` `/login/` and `/logout/` return 404, and a POST to them without a valid `_csrf` token gets 403 first, like every POST;
    - when nobody is logged in, every page request (not "every request"), including `/login/` and `/logout/`, is redirected to `loginUrl`.
  - Section 5, `getUser` row of the `AuthConfig` table: say "every page request" instead of "every request" (same inaccuracy as L014).
  - Section 6: next to the existing sentence "`register()` also rejects …", state that `register()` rejects the `password` widget on the primary key and on a field in `searchFields` or `ordering`.
  - Section 9: in the "Password widget." bullet (or the "Sorting." bullet), state that a `password`-widget list column has no sort link and that `o` ignores it.
  - Keep the 12 `##` headings and the reverse-proxy subsection as they are. test/readme.test.ts must pass unchanged.
- **Tests** (test-strategy.md):
  - admin row, "password widget restrictions": one `it.each` row per case in test/register.test.ts, each asserting the exact message.
  - views row: a `ListPage` column with `sortHref: null`.
  - Integration coverage, "Password widget (decision 037)", the "Not sortable" sentences: in test/password-widget.test.ts. The existing `t` admin already registers `kv` with `widgets: { value: "password" }` and `listDisplay: ["key", "value"]`. `beforeEach` sets row `a` to `s3cret`, so ordering by value would give a different row order from the expected one.
  - The L010 masked-cell FK-link rule has no reachable integration case. test-strategy.md says no further test is required, so do not write one.
- Record any export or prop not in the design in History.

## Definition of Done
- [ ] `register()`: test/register.test.ts has a new `it.each` (one case per row). Each row asserts the full message, including the `drizzle-admin: ` prefix:
  - `kv` with `widgets: { key: "password" }` → `drizzle-admin: kv: the primary key "key" cannot use the password widget`;
  - `authors` with `widgets: { name: "password" }, searchFields: ["name"]` → `drizzle-admin: authors: field "name" uses the password widget and cannot be in searchFields`;
  - the same widget with `ordering: ["name"]` and, in a separate row, with `ordering: ["-name"]` → `drizzle-admin: authors: field "name" uses the password widget and cannot be in ordering`.
  - A separate case: `authors` with `widgets: { name: "password" }`, `searchFields: ["email"]` and `ordering: ["-email"]` registers without throwing.
- [ ] `ListPage`: test/views.test.ts, in the `describe("ListPage")` that uses `listProps`, renders a column `{ key: "secret", sort: "none", sortHref: null }`. Then `th[data-key=secret]` has the text `secret`, has `data-sort="none"`, and contains no `a` element. In the same render, a column with a string `sortHref` still has its `a.sort`.
- [ ] List integration: test/password-widget.test.ts, both dialects, with the existing `t` admin:
  - `GET /admin/kv/`: `th[data-key=value]` has the text `value`, no `a.sort` and `data-sort="none"`, and `th[data-key=key]` contains `a.sort`;
  - `?o=value` and `?o=-value` (one `it.each` row each) list the row pks in the order `c`, `b`, `a`, and every `th` has `data-sort="none"`;
  - `?o=-value,key` lists `a`, `b`, `c`, and `th[data-key=key]` has `data-sort="asc"`.
- [ ] FK link: in src/routes/list.ts the condition that builds the `${prefix}/${refSlug}/…/change/` href includes the masked check (`!masked` or the equivalent from the shared masked-key source). The `listDisplayLinks` branch runs before it and is unchanged.
- [ ] `format.ts`: the four rule 0-3 conditions (`masked`, `formatter`, `value === null || value === undefined`, `fkLabel !== undefined`) appear in exactly one function, which both `formatCell` and `cellBoolean` call. test/format.test.ts has new cases:
  - `cellBoolean` with a formatter spy (`vi.fn(() => "x")`) and `value: true` returns `undefined` and the spy is never called;
  - `formatCell` with the same kind of spy calls it exactly once.
  - The existing `formatCell` / `cellBoolean` / `formatValue` cases pass unchanged.
- [ ] `Icon`: `git diff src/views/icons.tsx` changes only comment lines. The comment above the guard names the inherited-key case and cites views.md or decision 039. test/icons.test.ts passes unchanged.
- [ ] README.md:
  - contains "every page request" in the external-authentication paragraph and in the `getUser` row;
  - the external-authentication paragraph mentions `_csrf` and 403 for a POST to `/login/` or `/logout/`;
  - the sentence "When nobody is logged in, every request" no longer appears;
  - the "Model options reference" section mentions `password` together with `searchFields`, `ordering` and the primary key as a `register()` restriction;
  - the "Behavior notes" section says that a `password` column cannot be sorted;
  - test/readme.test.ts passes unchanged.
- [ ] Test diff (decision 041): in `git diff test/`, the only removed lines are edits to existing import lines that only add names. No existing test case is changed.
- [ ] `git diff --quiet src/forms src/views/url.ts src/types.ts src/index.ts src/messages.ts` succeeds (no change).
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (section "`admin.register(table, options = {})`", step 5)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (section "List (`GET /:model/`)", steps 2, 4b and 7)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (sections "Pages" (`ListPage` props), "`format.ts`", "Icons (`src/views/icons.tsx`)")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md (section "README.md outline", items 5, 6, 8 and 9)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (table rows "admin" and "views"; "Integration coverage", "Password widget (decision 037)" bullet)
- Decisions: docs/orchestraude/decisions/037-password-widget-no-echo.md (points 5-7), docs/orchestraude/decisions/039-ui-icons-inline-svg.md
- Triage: docs/orchestraude/drizzle-admin/06-low-findings-followup-triage.md (L010, L011, L014, L001, L007)
- Evidence: docs/orchestraude/evidence/2026-10-08-masked-list-column-sort-and-fk-link.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
