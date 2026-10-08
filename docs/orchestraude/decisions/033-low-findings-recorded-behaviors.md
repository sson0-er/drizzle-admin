# 033: Behaviors the low-findings triage asked to confirm and record

- Date: 2026-10-08
- Status: accepted

## Context
The low-findings triage (`docs/orchestraude/drizzle-admin/05-low-findings-triage.md`, section B) listed design gaps where the implementation chose a reasonable behavior that the design did not state. The user approved the orchestrator's recommendation to keep these behaviors and record them in the interface files. One item (L064) turned out to differ from the current code; see item 7.

## Decision
User decision (2026-10-08, bulk approval). Each item names the interface file that now states it.
1. L055 (auth.md `flash.ts`): a response that calls `addFlash` more than once may carry several `da_flash` Set-Cookie headers. Each holds all messages queued so far, so the last one is complete, and browsers keep the last one. No single-header requirement.
2. L057 (data.md `create`): when `.returning()` yields no row, `create` throws a plain `Error("drizzle-admin: insert into \"<table>\" returned no row")`. It is not a DB error (`isDbError` false), so the add handler rethrows it and `onError` answers 500.
3. L058 (routes-handlers.md Actions): `delete_selected` whose selected ids no longer match any row (`getMany` → `[]`) flashes the `noSelection` warning and redirects 303 back, on both the confirmation step and the `_confirm=1` step.
4. L059 (routes-handlers.md List step 4b): a column in `listDisplayLinks` links to the row's own change page even when it is also an FK column (`listDisplayLinks` wins; Django behaves the same, unverified).
5. L060 (routes-handlers.md List step 5): an FK filter value that is a valid key but not among the 200 offered choices still filters the rows, and the sidebar marks no FK choice as selected, so "all" is shown as selected. Accepted. The code comment in `src/routes/list.ts` that says an unknown value is treated as "all" by the repository is wrong for FK filters and is fixed in a follow-up task.
6. L061 (forms.md `buildFormGroups`): an FK field with `foreignKey.slug` but no `fkChoices` entry is treated as having an empty choice list (`?? []`). This is intended for fields the route does not query (display-only fields). Routes supply an entry for every editable FK field with a slug.
7. L064 (routes.md authGuard): a logged-out HEAD request is treated like GET: `next` is the requested path and query. Hono dispatches HEAD through the GET routes but `c.req.method` stays `"HEAD"` (evidence: 2026-10-08-hono-head-cookie-body-node-server). The current guard checks `method === "GET"` only and gives HEAD `next = <prefix>/`, so this needs a one-line follow-up code change (`GET` or `HEAD`).
8. L065 (routes-handlers.md List step 7, views.md): header `data-sort` reflects only an explicit `o` parameter, never the default ordering (`M.ordering` or `-pk`).
9. L066 (views.md `FormPage`): a display-only field whose widget is `hidden` still renders a labelled `div.form-row` with its `DisplayValue`. Only editable hidden fields render without a row.
10. L068 (routes-handlers.md Add step 6, Change step 4): an error from `repo.create` / `repo.update` that is not a DB error (`isDbError` false) is rethrown and becomes a 500 through `onError`, logged in full (decision 022). Only DB errors become form errors.
11. L069 (support.md): glyph-only literals with no words, namely the paginator's `‹` / `›` and the breadcrumb separator `›`, are exempt from the "no UI text outside messages.ts" rule.
12. L070 (forms.md `rawValues`): `rawValues` returns, for editable fields only, the last submitted string or `""`; boolean fields are normalized to `"on"` or `""` by the rule-1 check, so the checkbox re-renders in the state that was coerced.
13. L071 (admin.md finalization): if finalization throws on the first `admin.app` / `admin.fetch` access, the registry is not finalized: `register()` stays allowed, and the next access retries finalization.
14. L073: the SQLite `blob({ mode: "bigint" })` fixture is acceptable; already decided in decision 026. No change.
15. L075 (views.md `format.ts`): truncation to 100 characters + `…` applies to the output of rule 7 (JSON) and rule 10 (`String(value)`) only. Formatter output, `fkLabel`, booleans, dates, numbers and `[binary]` are not truncated. A long JSON value may be cut mid-token. A test pins JSON truncation (L135).
16. L076 (data.md `describeForLog`): `<name>` and `<code>` come from the first level of the cause chain (`err` and up to 5 `.cause` levels) whose string `code` maps to a kind; if none maps, from the first level with any string `code`; if no level has a code, `<name>` is the top-level error's name and `<code>` is `-`. A missing or empty name is `unknown`.
    Changed 2026-10-08 (L046, user-approved in the low-findings triage, section A): before output, `<name>` and `<code>` must each match `/^[A-Za-z0-9_.-]{1,64}$/`; a value that does not match is written `-`. A missing or empty name stays `unknown`. Classification still uses the raw code; only the log line is sanitized. Reason: the chosen level may be any error with a string `code`, not only a driver error, so a newline or very long value could forge or flood log lines.
17. L077 (forms.md coercion): rule 2's "empty" means missing or exactly `""`. Whitespace-only input is not empty; for kind number it is rejected as `invalidNumber` (it is not `Number("") === 0`).

## Alternatives considered
- L055: replace the earlier Set-Cookie header so only one is sent: needs header surgery on the Hono response for no browser-visible difference.
- L058: render an empty confirmation page or flash `deletedMany(0)`: a confirmation with nothing to confirm is confusing; `noSelection` tells the user to pick rows again.
- L060: add the active referenced row as an extra selected choice: one more query per page for a rare case.
- L064: keep HEAD as non-GET (`next = <prefix>/`): HEAD has no visible effect either way; treating it like GET matches how Hono routes it.
- L065: show the default ordering in the headers (as Django does): the header cycle (decision 013 item 5) is defined on the explicit `o` only.
- L066: render no row for display-only hidden fields: hides a value the user is allowed to see.
- L068: turn non-DB errors into a `dbOther` form error: hides bugs (decision 022 logs them in full).
- L069: add `previous` / `next` / separator keys to messages: no translation value for glyphs.
- L071: count a failed finalization as finalized: the caller could not fix the setup (for example by registering the missing table) without recreating the admin.
- L075: show JSON in full: a very large value would bloat the list page.
- L077: treat whitespace-only number input as empty under rule 2: silently turns a typo into null or a missing-value error.

## Rationale
User decision (2026-10-08) on the orchestrator's recommendations. The behaviors were already implemented and reviewed (`05-low-findings.md`), except item 7. Hono's HEAD dispatch and `c.req.method` were checked against the installed version (evidence: 2026-10-08-hono-head-cookie-body-node-server). The browser "last Set-Cookie wins" reading in item 1 is unverified; the reviewer stated it and no test depends on multiple headers.

## Consequences
- Interface files updated: auth.md, data.md, forms.md, routes.md, routes-handlers.md, views.md, support.md, admin.md; test-strategy.md gains the pinned tests (L135, L138).
- Follow-up code changes: item 7 (auth guard HEAD) and the item 5 code comment. No other code change.
- Changed 2026-10-08: item 16's output sanitization (L046) is a follow-up code change in `src/data/errors.ts`, with a unit test in `errors.test.ts`.
