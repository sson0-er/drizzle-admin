# Low findings triage (follow-up tasks 27-39): drizzle-admin

Input: `06-low-findings-followup.md` (raw 30, merged 30). Triaged merged items: 12 + 2 + 13 + 3 = 30, which matches the input header. Every merged item has 1 occurrence, so raw equals merged in each bucket.

| Bucket | Merged | Raw |
|---|---|---|
| A. Fix recommended | 12 | 12 |
| B. Decisions needed | 2 | 2 |
| C. Accepted as-is | 13 | 13 |
| D. Convention candidates | 3 | 3 |
| Total | 30 | 30 |

Notes:
- `docs/orchestraude/review-policy.md` was applied. Items whose code the policy already accepts (duplication up to three copies, assertions implied by another test, CSS and README assertion precision) are in C with a reference. Items where the code goes against an adopted convention (L007, L020, L023) are in A, because the convention asks for the fix.
- The task 26/v1 leftovers named by the orchestrator are already in the merged list: the sortable password column is L011 (B), and the external-mode README wording (`/static/admin.css` served to anonymous users, POST `/logout/` without a valid `_csrf` gets 403) is L014 (A). Nothing was added.
- I checked the code: three items are already fixed. L009: `example/server.ts:11` uses `process.env.HOST || "127.0.0.1"`. L016: `CLAUDE.md:19` now says "named per module or concern". L024: `test/password-widget.test.ts:46` re-seeds in `beforeEach`. All three are in C as resolved.

## A. Fix recommended

### README.md
- L014 [spec] External-mode wording slightly over-generalizes (1 occurrence) — README.md:232 — It is the same kind of security-model inaccuracy that L082 fixed in the first round. Say "every page request" (`/static/admin.css` is served without a redirect) and "GET /login/ and /logout/ return 404" (a POST to /logout/ without a valid `_csrf` gets 403 first). This is a one-line rewording.

### src
- L010 [security] FK auto-link on a masked list cell exposes the value in its href (1 occurrence) — src/routes/list.ts:168-184 — The cell is masked, but the href still contains the raw value, and leaving the link out for null values shows whether a value is set. Both go against decision 037 point 5. The fix is small and safe: compute `masked` once and add `!masked` to the FK-link condition.
- L001 [quality] cellBoolean re-encodes formatCell precedence rules (1 occurrence) — src/views/format.ts:62 — The two copies of the masked/formatter/fkLabel precedence must stay in sync for correctness: if they drift, a masked cell can show a boolean icon. The adopted duplication convention asks for a shared helper in exactly this case.
- L007 [quality] Unreachable Object.hasOwn guard in Icon (1 occurrence) — src/views/icons.tsx:39 — The adopted convention says not to keep guards that the types already exclude. Remove the guard, or keep it with a why-comment if the orchestrator considers a cast-only call site a real boundary. Low priority.

### test
- L008 [security] Denied add-POST case does not check that no row was inserted (1 occurrence) — test/auth.test.ts:518 — If the gate inserted the row before returning 403, the test would still pass. Assert that no `added-<id>` author exists after the denied request.
- L019 [tests] Denied add POST is not checked for a created row (1 occurrence) — test/auth.test.ts:476 — Same as L008.
- L012 [spec] 403-matrix test titles render the path as "[Function path]" (1 occurrence) — test/auth.test.ts:513-514 — Case names collide, so a failure in the permission matrix does not say which route broke. Add a `label` field and use `$label` in the title.
- L022 [tests] Flash XSS test does not assert the text is kept as text (1 occurrence) — test/views.test.ts:719 — If the message were dropped, this XSS test would still pass. Assert `text(li)` contains the literal payload, the same way the cell XSS test (views.test.ts:627) does.
- L017 [tests] aria-hidden test depends on state filled by earlier tests (1 occurrence) — test/views.test.ts:727 — The test passes vacuously when run alone or shuffled. Move the check into the shared `render` helper, or render the pages inside the test.
- L020 [tests] DisplayValue test checks two unrelated cases in one it.each row (1 occurrence) — test/widgets.test.ts:253 — It goes against the adopted one-case-per-row convention, and a failing first assertion hides the second. Split into `{zone, field, value, expected}` rows.
- L023 [tests] Form test falls back to the whole document when the select is missing (1 occurrence) — test/form.test.ts:189 — `select ?? doc` hides a missing element. The convention says to use a non-null assertion (or an explicit not-null expect) instead of a fallback.
- L026 [tests] No boundary case for a long name in describeForLog (1 occurrence) — test/errors.test.ts:110 — This is log-injection hardening (task 36), and the name path of the 64/65 boundary has no test. One more table row covers it.

## Follow-up task candidates (from A)

1. Masked-column list hardening. Files: src/routes/list.ts, and a test in test/password-widget.test.ts. Why: decision 037 point 5. Covers L010. If L011 is decided as "not sortable", include it here.
2. README external-mode wording. Files: README.md (plus test/readme.test.ts if the sentence is pinned). Covers L014.
3. Format and icon cleanup. Files: src/views/format.ts, src/views/list.ts call site, src/views/icons.tsx. Covers L001 and L007.
4. Security test precision. Files: test/auth.test.ts, test/views.test.ts. Covers L008, L019, L012, L022.
5. Test independence and table shape. Files: test/views.test.ts, test/widgets.test.ts, test/form.test.ts, test/errors.test.ts. Covers L017, L020, L023, L026.
Batching: 1 and 2 can be one task (docs plus a one-line source change). 4 and 5 can be one test-only task. 3 is small enough to go with 1.

## B. Decisions needed

- L013 [spec] (pre-assigned) DoD test-diff rule does not allow for edited import lines — test/format.test.ts:3 — Question: Should future DoDs say "the only removed lines in `git diff test/` are X, apart from edits to import lines that add new names", and should task 38's import edits be accepted under that reading?
- L011 [security] Sorting by a masked list column still reveals whether the value is set — src/routes/list.ts:131, 192 — This is also the task 26/v1 leftover. Making the column non-sortable changes behavior (no sort link in the header, and `?o=` silently ignored for that key). Question: Should password-widget columns be excluded from `?o=` sorting and lose their sort link (fits decision 037 point 5), or should we accept that the NULL vs set grouping shows and record it in review-policy.md?

## C. Accepted as-is

- L009 [security] Empty HOST binds the demo to all interfaces — resolved: example/server.ts:11 already uses `||`.
- L016 [spec] test/ described as "one file per module" — resolved: CLAUDE.md:19 now says "per module or concern".
- L024 [tests] Integration cases depend on execution order — resolved: test/password-widget.test.ts:46 re-seeds in `beforeEach`.
- L002 [quality] Duplicate token values — the values are given by the design; the duplication is intentional.
- L003 [quality] list.test.ts rebuilds an admin inline — already accepted policy (duplication convention, up to three copies).
- L025 [tests] List test builds a full createAdmin config inline — same as L003; already accepted policy.
- L006 [quality] Typed db cast duplicated between describes — already accepted policy (duplication convention: two copies).
- L004 [quality] Nullable FK empty-choice case overlaps an existing test — the inputs differ (no entry vs a choices list), so neither test fully implies the other.
- L005 [quality] Template literal without interpolation — cosmetic; lint passes.
- L021 [tests] Flash icon integration only covers success — warning and error are covered at the view level; the reviewer calls it acceptable.
- L027 [tests] No spy that no getMany/options query runs for a hidden FK — the rendered output is the security property; a spy would couple the test to repository internals.
- L028 [tests] Page-wide script assertion implies the form-scoped one — already accepted policy (implied-assertion convention: reviewers report existing ones as C); the DoD wording asked for the form-scoped check.
- L030 [tests] Removed README phrases not pinned — already accepted policy (L115: README test precision is low value); the task did not require it.

## D. Convention candidates

- `Stylesheet tests pin token values and the presence of key rules; selector-match precision, it.each table shape and length-only checks of literal lists in those tests are not raised in review.` — retires L015, L018, L029 — 3 occurrences in this round (task 39), plus 3 earlier accepted lows of the same kind (L016, L098, L120 in review-policy.md, tasks 1x-2x), for 6 in total across both triage rounds.
