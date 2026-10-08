# Low findings triage: drizzle-admin

Input: `05-low-findings.md` (raw 139, merged 139). Triaged merged items: 41 + 26 + 33 + 39 = 139, which matches the input header. Every merged item has 1 occurrence, so raw equals merged in each bucket.

| Bucket | Merged | Raw |
|---|---|---|
| A. Fix recommended | 41 | 41 |
| B. Decisions needed | 26 | 26 |
| C. Accepted as-is | 33 | 33 |
| D. Convention candidates | 39 | 39 |
| Total | 139 | 139 |

Notes:
- `docs/orchestraude/review-policy.md` does not exist, so no item was closed as "already accepted policy".
- 3 of the 24 pre-assigned B items are already resolved according to the orchestrator: L056 and L063 (decisions 027-032) and L078 (task 23 stores only id and name). They are listed under C as "resolved" so they are not raised again. The other 21 pre-assigned items remain B.
- Some orchestrator follow-up candidates are not in the merged list, so they are not triaged here: the password widget echoing the stored value (decision 013 item 11), the POST body size limit (task 14), and the example server binding to all interfaces with admin/admin (task 06). Track them separately.

## A. Fix recommended

### README.md
- L049 [security] Logout does not revoke the stateless session cookie (1 occurrence) — README.md:228 — Deployers currently get an inaccurate threat model. Add a Known limitations line: logout deletes the cookie but does not revoke it, and rotating the secret invalidates all sessions.
- L050 [security] Origin check scope is overstated (1 occurrence) — README.md:245, 276 — The README describes a guarantee the code does not give (only form-like unsafe requests are Origin-checked). Rewording it is a one-line change.
- L087 [spec] Origin check described as applying to every request (1 occurrence) — README.md:250 — Same root cause as L050. Fix both together.
- L051 [security] Quick start compares passwords with plain === (1 occurrence) — README.md:56 — People will copy this snippet. Add a comment saying to use hash verification or a constant-time comparison, and that login has no rate limiting.
- L082 [spec] External mode: /login/ and /logout/ return 404 only for authenticated requests (1 occurrence) — README.md:229 — The documented behavior is wrong for anonymous requests, which get redirected or a 401. Rewording it is a one-line change.

### src
- L083 [spec] FK choice ordering is pk ascending when the referenced model has no `ordering` (1 occurrence) — src/routes/list.ts:93, src/routes/form.ts:62 — This deviates from decision 013 item 7 and from the README. The list page already falls back to `-pk` (list.ts:116-121), but the FK selects and the FK filter choices pass `ref.ordering` as is. Reusing the same fallback is a small fix and makes the 200-row cap pick the same rows the design describes.
- L046 [security] describeForLog emits name and code verbatim (1 occurrence) — src/data/errors.ts:52 — This is cheap log-injection hardening: limit name and code to `/^[A-Za-z0-9_.-]{1,64}$/` and use '-' otherwise.
- L045 [security] Custom actions receive raw, unvalidated ids (1 occurrence) — src/routes/actions.ts:104 — This keeps the designed API. Document in the `run` JSDoc and the README that `ids` is untrusted client input that must be validated. Passing only the ids that resolved would change behavior and is out of scope here.
- L004 [quality] safeNext doc comment has a doubled word and understates the `//` rule (1 occurrence) — src/auth/redirect.ts:17 — The comment on a security-critical function should match the code.
- L080 [spec] Duplicated word in the safeNext doc comment (1 occurrence) — src/auth/redirect.ts:17 — Same as L004.

### example
- L002 [quality] Clamped age is computed at module load, not at seed call (1 occurrence) — example/seed.ts:47 — This is a correctness bug at month boundaries. Computing the clamp inside seed() from the same `now` fixes it in one line.
- L090 [spec] This-month clamp uses the date at module load (1 occurrence) — example/seed.ts:47 — Same as L002.

### test
- L044 [security] The "leaves the data alone when delete is refused" test cannot detect a bypass (1 occurrence) — test/auth.test.ts:478 — The FK on author 1 makes this a security test that can never fail. Target a row with no dependents and send `_confirm=1`.
- L089 [spec] The same test passes even if the delete is not refused (1 occurrence) — test/auth.test.ts:479 — Same as L044.
- L096 [tests] Control requests in the 403 matrix mutate shared data (1 occurrence) — test/auth.test.ts:456 — The tests depend on run order and on the FK accident. Delete a dedicated row in the controls and check that the change POST left the row unchanged.
- L053 [security] XSS payload does not exercise attribute-context escaping (1 occurrence) — test/auth.test.ts:581 — Adding a `"><script>` payload covers attribute breakout, which is the real risk on the change page.
- L086 [spec] New test-strategy trailing-slash cases only partly tested (1 occurrence) — test/pages.test.ts:124 — test-strategy.md lists cases (`%20`, `///evil.example`, query-preserving 301s, `text/html` 404) that no test covers. They are open-redirect-adjacent.
- L092 [tests] Allowlist whitespace and 0x7f branches not exercised (1 occurrence) — test/pages.test.ts:126 — Same it.each lists as L086. Add `%20` and `%7f`.
- L091 [spec] Two pages.test.ts cases always use sqlite inside describe.each (1 occurrence) — test/pages.test.ts:30 — Passing `fixture` instead of `dialects[0]` restores pg coverage.
- L093 [tests] Backslash search test cannot detect a broken escape (1 occurrence) — test/repository.test.ts:113 — LIKE escaping is a correctness and safety path. Add a fixture row that contains a backslash.
- L097 [tests] The create error test only asserts that something throws (1 occurrence) — test/repository.test.ts:261 — The design says the driver error is passed through unchanged, so assert its message pattern.
- L054 [spec] Date-before-FK branch precedence has no test (1 occurrence) — test/query.test.ts — The design requires this order, and nothing would catch a reordering.
- L100 [tests] Date-kind FK precedence and the unknown-column error are untested (1 occurrence) — test/query.test.ts — Same as L054, plus a columnOf toThrow case.
- L099 [tests] Date presets past7 and year never run through buildFilters (1 occurrence) — test/query.test.ts:106 — An it.each over presets covers the remaining dateRange branches cheaply.
- L101 [tests] datePresetRange not tested across a DST transition day (1 occurrence) — test/time.test.ts:200 — 23-hour and 25-hour days are the main time-zone risk. Add 2026-03-08 and 2026-11-01 in America/New_York.
- L106 [tests] DisplayValue lacks date-only and json cases (1 occurrence) — test/widgets.test.ts:262 — Date-only display depends on the time zone and has no test.
- L102 [tests] dbOther and non-DB error branches untested in delete (1 occurrence) — test/delete.test.ts — A throwing repo stub covers both error-handling branches.
- L103 [tests] dbOther and non-DB rethrow paths unreached in bulk delete (1 occurrence) — test/delete.test.ts:150 — Same stub as L102.
- L114 [tests] isDbError DrizzleQueryError instanceof branch has no isolated test (1 occurrence) — test/errors.test.ts:68 — The branch could be deleted without any test failing. Add one synthetic case.
- L108 [tests] Flash tampered-cookie test does not assert the tamper took effect (1 occurrence) — test/flash.test.ts:78 — A one-line guard keeps the test from passing for the wrong reason.
- L111 [tests] Invalid flash cookie deletion is not asserted (1 occurrence) — test/flash.test.ts:70 — The code deletes the cookie on purpose, but nothing checks it.
- L116 [tests] Layout without flash messages is not asserted (1 occurrence) — test/views.test.ts:128 — One assertion pins the empty case.
- L117 [tests] No test for multi-column FK ignored, isGenerated, or unknown kind (1 occurrence) — test/introspect.sqlite.test.ts — These are design mapping rules with no coverage.
- L118 [tests] No test pins the exact public exports of src/index.ts (1 occurrence) — test/types.test.ts — This is a DoD item. One assertion stops internal types or functions from leaking into the runtime API.
- L119 [tests] No test pins the seed date distribution (1 occurrence) — test/example.test.ts:5 — The round-1 defect got through for exactly this reason.
- L121 [tests] Override case with `active: checkbox` cannot fail (1 occurrence) — test/fields.test.ts:190 — Override to a different widget and assert the result.
- L128 [tests] refSlugOf test helper mirrors the implementation fallback (1 occurrence) — test/fields.test.ts:70 — Passing a distinct slug proves refSlugOf is actually used.
- L136 [tests] Untested edge branches in FK handling (1 occurrence) — test/fields.test.ts / src/forms/fields.ts:130 — Covers bigint FK with tooMany and a non-select override with a choices list. The missing-entry case should wait for the B decision on L061.
- L137 [tests] Bigint whitespace trim and date-kind format rejection untested (1 occurrence) — test/coerce.test.ts:112 — Two one-line assertions on input coercion.
- L034 [quality] Test helper regex has a dead alternative and interpolates the option name (1 occurrence) — test/config.test.ts:16 — A short option name can match anywhere in the message, so a failure on the wrong rule would not be caught.
- L129 [tests] rejects helper regex is looser than intended (1 occurrence) — test/config.test.ts:16 — Same as L034.

## Follow-up task candidates (from A)

1. README accuracy pass. Files: README.md. Why: the security model and behavior are described wrongly. Covers L049, L050, L087, L051, L082, and L045 (document that `ids` is untrusted).
2. FK choice default ordering. Files: src/routes/list.ts, src/routes/form.ts, plus a test. Why: deviation from decision 013 item 7. Covers L083. Can be batched with 3.
3. Security hardening of code and comments. Files: src/data/errors.ts, src/auth/redirect.ts, the `run` JSDoc in src/types.ts. Why: log-injection guard and an accurate safeNext comment. Covers L046, L004, L080, and the JSDoc part of L045.
4. Security test fixes. Files: test/auth.test.ts, test/pages.test.ts. Why: the delete-refusal test cannot fail, the controls mutate shared data, attribute XSS and redirect allowlist cases are missing. Covers L044, L089, L096, L053, L086, L092, L091.
5. Data and time test gaps. Files: test/query.test.ts, test/repository.test.ts, test/errors.test.ts, test/time.test.ts, test/delete.test.ts. Covers L054, L100, L099, L093, L097, L114, L101, L102, L103.
6. Forms, views and auth test gaps. Files: test/fields.test.ts, test/coerce.test.ts, test/widgets.test.ts, test/flash.test.ts, test/views.test.ts, test/types.test.ts, test/config.test.ts, test/introspect.sqlite.test.ts. Covers L121, L128, L136, L137, L106, L108, L111, L116, L118, L117, L034, L129.
7. Example seed fix and test. Files: example/seed.ts, test/example.test.ts. Covers L002, L090, L119.
Batching: 1 and 3 can be one docs-and-hardening task. 5 and 6 can be one test-only task. 2 and 7 are small enough to go with either.

## B. Decisions needed

- L055 [spec] addFlash emits one Set-Cookie header per call — src/auth/flash.ts:31 — Question: Should a response that calls addFlash more than once carry a single da_flash Set-Cookie header (replacing the earlier one), or are multiple headers acceptable as long as the last one is complete?
- L057 [spec] create throws when insert returns no row — src/data/repository.ts:103 — Question: Should data.md state that create throws a plain Error when `.returning()` yields no row, or should we leave it unspecified as unreachable?
- L058 [spec] delete_selected with no surviving rows flashes noSelection — src/routes/actions.ts:68 — Question: When none of the selected ids exist any more, should delete_selected show a noSelection warning with a 303 (current behavior), an empty confirmation page, or `deletedMany(0)`?
- L003 [quality] Custom-action confirm page can list zero rows — src/routes/actions.ts:102 — Question: Should custom actions with a confirm step behave like delete_selected (noSelection warning) when getMany finds no rows, instead of rendering an empty confirmation list?
- L138 [tests] Vanished-rows branch of delete_selected is untested — test/delete.test.ts:150 — Question: Once L058 is decided, should a test pin that behavior with a nonexistent id, asserting the flash and the status?
- L059 [spec] FK column also in listDisplayLinks links to the row's change page — src/routes/list.ts:158 — Question: Should listDisplayLinks take precedence over the FK link when a column is both (current behavior, matches Django)?
- L060 [spec] FK filter value outside the 200 offered choices filters rows but marks "all" selected — src/routes/list.ts:185 — Question: Should we (a) accept this and fix the comment, or (b) show the active referenced row as an extra selected choice, or mark no choice as selected?
- L061 [spec] FK with slug but no fkChoices entry becomes an empty select — src/forms/fields.ts:127 — Question: Is the `?? []` fallback intended (for example, display-only fields where routes skip the query), or should a missing entry throw as a caller bug?
- L062 [spec] fkFallbackHref set on non-select FK overrides with tooMany — src/forms/fields.ts:137 — Question: Should the "too many choices" fallback link appear only for the default and `select` widgets (as the implementer's report claims), or also for `hidden`, `number` and `text` overrides?
- L064 [spec] HEAD handling in the auth guard — src/routes/middleware.ts:70 — Question: Should a logged-out HEAD request be treated like GET, so `next` is the requested path, and should routes.md say so?
- L065 [spec] Header data-sort reflects only `o`, not the default ordering — src/routes/list.ts:174 — Question: Should column headers show a sort indicator for the default ordering (as Django does), or only for an explicit `o` (current behavior)?
- L066 [spec] Hidden-widget rows are skipped only for editable fields — src/views/form.tsx:43 — Question: Should a display-only field with a `hidden` widget override still render a labelled DisplayValue row (current behavior), or render no row?
- L067 [spec] List column headers and filter headings show raw field keys — src/views/list.tsx:127 — Question: Should ListPage `columns` and `filters` carry a human `label` (filled in by the route from the field metadata) so headers show labels instead of keys like `authorId`?
- L068 [spec] Non-DB errors from create/update give a 500 instead of a dbOther form error — src/routes/form.ts:163 — Question: Should non-DB errors thrown by repo.create/update stay as 500s through onError (current behavior, fits decision 022), and should routes-handlers.md record this?
- L069 [spec] Paginator ‹ › and breadcrumb separator are literals outside messages — src/views/list.tsx:49 — Question: Should these glyphs become messages keys (for example `previous` and `next`), or are glyph-only literals exempt from the "no UI text outside messages.ts" rule?
- L070 [spec] rawValues normalizes boolean fields to "on"/"" — src/forms/coerce.ts:109 — Question: Should forms.md document that rawValues normalizes booleans to "on" or "" for re-rendering?
- L071 [spec] Registry stays open after a failed finalization — src/admin.ts:309 — Question: After the first admin.app access throws, should register() still be allowed and finalization be retried (current behavior), or should the failed attempt count as finalized?
- L072 [spec] Deletion cookies lack Secure when publicOrigin is https — test/proxy.test.ts:62, src/auth/flash.ts:46, src/auth/session.ts:86 — Question: Should (a) the DoD be read as "the cookie when it is set" and the POST check be accepted, or (b) deletion cookies also carry Secure under an https publicOrigin, with a follow-up change in flash.ts and session.ts and a GET test?
- L073 [spec] SQLite `articles.big` is blob({mode:"bigint"}) — test/fixtures/schema-sqlite.ts:26 — Question: Is blob storage, which compares bytewise rather than numerically, acceptable for the SQLite bigint fixture, or should the design name a different SQLite column type?
- L074 [spec] Success flash when repo.delete removes 0 rows — src/routes/delete.ts:57 — Question: When a concurrent delete leaves 0 rows to remove, should the handler still flash "deleted", or return a 404 or a different message?
- L075 [spec] Truncation scope for JSON cells — src/views/format.ts:37 — Question: Should JSON text in list cells be truncated at 100 characters (current behavior, which can cut mid-token), or shown in full?
- L135 [tests] Truncation of JSON output untested — test/format.test.ts:93 — Question: Once L075 is decided, should a test pin JSON truncation (or its absence)?
- L076 [spec] describeForLog name and code source level and "-" placeholder — src/data/errors.ts:43 — Question: Should data.md record that name and code come from the first cause level with a mapped code, with "-" when there is none?
- L077 [spec] Whitespace-only number rejected as invalidNumber — src/forms/coerce.ts:37 — Question: Should whitespace-only input be rejected as invalidNumber (current behavior), or treated as empty under rule 2, and should forms.md say which?
- L047 [security] FK choices in add/change disclose labels of a referenced model the user cannot view — src/routes/form.ts:48 — Question: Should FK selects be hidden or restricted when the user lacks view permission on the referenced model, or is the Django-like behavior accepted and recorded in review-policy.md?
- L048 [security] FK labels and FK filter choices ignore the referenced model's view permission — src/routes/list.ts:59 — Question: Should list FK labels, links and the FK filter be skipped when `!can(ref, "view", user)`, or is this accepted as a convention?

## C. Accepted as-is

- L056 [spec] ConfirmActionPage extra listHref prop — resolved by decisions 027-032.
- L063 [spec] FormPage extra timeZone prop — resolved by decisions 027-032.
- L078 [spec] writeSession serializes extra user fields — resolved in task 23 (the cookie stores only id and name).
- L001 [quality] Tuple cast in parseDatetimeLocal — style only.
- L014 [quality] Login route registration repeats the builtin check — both places are correct; an optional comment.
- L015 [quality] Missing fkChoices entry becomes an empty select — handled by the B decision on L061.
- L016 [quality] Narrow-screen test asserts overflow-x on the whole stylesheet — CSS assertion precision; low regression value.
- L020 [quality] Paginator props passed field by field — style only.
- L021 [quality] parsePk is an alias of parseFieldValue — required by the design API; works.
- L023 [quality] Redirect target branching duplicates checks — refactor preference.
- L029 [quality] Registry not frozen — the register-after-app guard already prevents mutation; the comment wording is a preference.
- L030 [quality] renderLogin re-vets next — the reviewer says no change is required.
- L031 [quality] resolveModel does several jobs — refactor preference.
- L032 [quality] Side-effecting counter in the seed mapper — demo code, readable enough.
- L035 [quality] toSnapshot emits both table and tableName — changing it churns snapshots for no behavior gain.
- L036 [quality] Unneeded returning() and `float: none` — cosmetic.
- L038 [quality] Unreachable empty-enum fallback cast — unreachable in practice; coercion already rejects the input.
- L039 [quality] FormPage does not read mode and modelLabel — they come from the design prop table.
- L040 [quality] update() parses the PK twice — micro-optimization.
- L041 [quality] Weak `"app" in admin` assertion — test cosmetics; later tasks cover app.
- L052 [security] Unknown-action check runs before the permission check — action names are not sensitive; the impact is negligible.
- L084 [spec] Task 01 History contradiction about `!docs` — historical record only; biome.json is correct.
- L085 [spec] hookTimeout comment says "Same reason" — comment wording only.
- L094 [tests] Boolean empty-string assertion under a "false" test name — naming only.
- L098 [tests] Dark-mode test uses a loose pattern — CSS assertion precision; low regression value.
- L104 [tests] Default time zone assertion recomputes the implementation — acceptable as an environment check.
- L107 [tests] fetch test cannot distinguish mounting — prefix mounting is covered by the task 14 route tests.
- L115 [tests] README key check is a substring match — README test precision; low value.
- L120 [tests] overflow-x assertion not scoped to the narrow block — same as L016.
- L124 [tests] Loose "required" substring assertion — it works today; precision preference.
- L130 [tests] Session expiry test hardcodes 28800 — minor fragility; the failure would be obvious.
- L133 [tests] Explicit notNull checks missing on the SQLite autoincrement pk — covered by snapshots.
- L134 [tests] Tampered cookie construction is hard to follow — readability only.

## D. Convention candidates

- `Do not add single-use alias variables such as \`const model = found\` or \`const title = actionLabel\`; use or rename the original binding.` — retires L017, L018, L019, L024 — 4 occurrences (tasks 02, 15, 19, 21).
- `In tests, put independent input/expected cases in an it.each table (one case per row) instead of for-loops or many unrelated expects in one it; use exact status/flash assertions, not not.toBe(...).` — retires L095, L112, L113, L122, L125, L131, L132, L139 — 8 occurrences (tasks 01, 02, 03, 05, 07, 11, 20, 21).
- `Small duplication (one-line helpers, option literals, JSX, test setup) in up to three places is acceptable; extract a shared helper only at the fourth copy or when the copies must stay in sync for correctness (e.g. cookie security attributes).` — retires L005, L006, L007, L008, L009, L010, L011, L043, L126 — 9 occurrences (tasks 03, 05, 07, 08, 12, 18, 19, 20, 24).
- `Do not add tests or assertions that another test in the same file already fully implies (typeof checks before a call, a regex next to an exact-message match, not.toBe before toBe); review reports existing ones as C only.` — retires L012, L025, L042, L105, L109, L110, L123, L127 — 8 occurrences (tasks 01, 02, 10, 12, 24, 26).
- `Keep helpers and constants module-private unless another module imports them; any export or prop not in the design must be recorded in the task History so the orchestrator updates the design.` — retires L013, L079, L081, L088 — 4 occurrences (tasks 03, 16, 17).
- `Do not keep guards, branches or throws that the preceding code already makes impossible (re-narrowing, dead fallbacks, String() wrappers); use a non-null assertion with a short why-comment when the type system cannot see it.` — retires L022, L026, L027, L028, L033, L037 — 6 occurrences (tasks 03, 04, 10, 11, 16, 18).
