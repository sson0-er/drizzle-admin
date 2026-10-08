# Low findings triage (security-audit fix tasks 43-48): drizzle-admin

Input: `07-low-findings-security.md` (raw 18, merged 18). Triaged merged items: 7 + 0 + 11 + 0 = 18, which matches the input header. Every merged item has 1 occurrence, so raw equals merged in each bucket.

| Bucket | Merged | Raw |
|---|---|---|
| A. Fix recommended | 7 | 7 |
| B. Decisions needed | 0 | 0 |
| C. Accepted as-is | 11 | 11 |
| D. Convention candidates | 0 | 0 |
| Total | 18 | 18 |

Notes:
- `docs/orchestraude/review-policy.md` was applied. Items that the policy or an adopted convention already accepts are in C with a reference. Items where the code goes against an adopted convention (L007, L009: dialect branching inside one `it`; L008: exact flash assertions) are in A, because the convention asks for the fix.
- L006 was listed under "Pre-assigned B". Per the orchestrator's instruction it is in C, not B. The code agrees: `README.md:262` says what `SELECT_ALL_SCRIPT_SHA256` stands for and names the file it lives in (`src/static/select-all.ts:9`). The admin sends its own CSP (`buildCsp`, `src/routes/middleware.ts:28`), and `CLAUDE.md:32` already says to update the hash together with the script. A literal value in the README would go stale whenever the script changes, and no test would catch it.
- I checked the current code. None of the 18 items is fixed yet. The lines cited in the findings still match the code (L005: the parameter is now at `src/routes/middleware.ts:51`).

## A. Fix recommended

### test
- L007 [spec] PG/SQLite views=3000000000 outcome uses an inline conditional (1 occurrence) — test/form.test.ts:491-501 — The task notes asked for the per-dialect outcome as data, and the adopted it.each convention asks for one case per row. Today the status is a ternary and the error check sits inside `if (fixture.name === "pglite")`.
- L009 [tests] Conditional assertions inside one test depending on dialect (1 occurrence) — test/form.test.ts:491-501 — Same test as L007. On SQLite the test checks only the 303 and nothing about the stored value, so a regression that drops or truncates the value on SQLite would go unnoticed. Assert the stored row (`views: 3000000000`) on SQLite.
- L010 [tests] Dashboard hidden-link test has no positive control (1 occurrence) — test/auth.test.ts:754-759 — This is a security property (decision 043, hidden models). If the dashboard link shape changes, the test passes without checking anything. Add a `clientWith({})` request in the same test that does find an `/admin/authors/` link.
- L008 [spec] Selection-cap tests filter flashes by the warning class (1 occurrence) — test/actions.test.ts:207, 214 — The task asked for "exactly one flash", and the convention asks for exact flash assertions. Compare the unfiltered `flashes(client, res)` to `[messages.tooManySelected(500)]`. This is a one-line change per test.
- L013 [tests] int16 lower bound and the bigint case without valueCheck are not tested (1 occurrence) — test/query.test.ts:321-340 — This is the key-value domain hardening from task 45. The int16 min/below-min rows are missing while int32 has both. Two or three more table rows fix it.
- L016 [tests] Search normalization rows omit trim and code-point cut (1 occurrence) — test/list.test.ts:167-175 — The surrogate-safe cut and the trim are implemented but not pinned. A regression back to a UTF-16 `slice` would split a surrogate pair. Add two rows.
- L018 [tests] Wildcard-bind branches not exercised (1 occurrence) — test/example.test.ts:93-107 — This is the DNS-rebinding guard. Four paths in `example/host-guard.ts` have no row: the `[::]` wildcard with an IPv6 literal (`h.startsWith("[")`, line 21), a wildcard bind with `localhost`, a bind host in uppercase, and the https default port 443 (line 15). Add these rows to the existing table.

## Follow-up task candidates (from A)

1. Per-dialect outcome as data. Files: test/form.test.ts. Why: adopted it.each convention and a missing SQLite stored-value check. Covers L007, L009.
2. Security test controls and exact flashes. Files: test/auth.test.ts, test/actions.test.ts. Why: a hidden-model test that can pass without checking anything, and inexact flash checks. Covers L010, L008.
3. Boundary rows for the audit fixes. Files: test/query.test.ts, test/list.test.ts, test/example.test.ts. Why: untested branches in input-domain, search-normalization and host-guard code. Covers L013, L016, L018.

Batching: all three are test-only with no source change and can be one task.

## B. Decisions needed

None. L006, the only pre-assigned B item, is in C as the orchestrator instructed (see Notes).

## C. Accepted as-is

- L006 [spec] README CSP string uses the constant name instead of the hash value — the admin sends its own CSP, so host apps need not copy it. The README names the file that holds the value, and a literal would go stale (orchestrator's view, confirmed against README.md:262 and CLAUDE.md:32).
- L001 [quality] forms/coerce.ts imports parseFieldValue from data/query.ts — layering preference. Reusing the function keeps a single source for the domain rules, and `parseFieldValue` builds no query.
- L002 [quality] inherit repeats the permission option type — refactor preference. The union appears twice, and a drift would show up as a type error at the call site.
- L003 [quality] Integer range lookup in parseFieldValue is roundabout — style only.
- L004 [quality] Magic number 34560000 in config validation — the literal and the message that explains it ("400 days") are on adjacent lines (src/admin.ts:77-79). Readability preference.
- L005 [quality] Unused _state parameter on sessionMiddleware — the design fixes the signature `sessionMiddleware(state, getCookieKeys)` (routes.md, decision 042), and task 43's History records this. The reviewer says to ignore it in that case.
- L011 [tests] Form-level hex case duplicates a coerce unit test — the two tests are in different files and at different levels (unit and route). The duplicate is harmless.
- L012 [tests] hostGuard test does not show next is skipped — the reviewer calls it acceptable. The exact guard body shows the handler did not run.
- L014 [tests] Permission table uses `users[0] as never` — the cast is not unnecessary: under `noUncheckedIndexedAccess` (tsconfig.json:8) `users[0]` is possibly undefined. Changing it to a const user is a cosmetic change, and the `byId` expectations are a style preference.
- L015 [tests] Redundant not.toContain after exact CSP match — already accepted policy (FL028: the implied-assertion convention, and the DoD asked for it). Task 47 DoD line 54 explicitly requires "no `form-action`".
- L017 [tests] Search tests assert only the echoed value — the table runs on both dialects (`describe.each(dialects)`, test/list.test.ts:105). If the raw q reached the query, the PG run would fail its 200 check on the NUL row, so the regression is already caught.

## D. Convention candidates

None. No C-shaped item came up in 3 or more tasks. The closest is "an implied assertion that the DoD explicitly asked for" (FL028, L015): 2 occurrences, already covered by FL028 in review-policy.md.
