---
id: 53-security-low-findings-tests
depends_on: [49-i18n-dictionaries-and-request-locale]
status: pending
attempts: 0
---
# Task 53: security-low-findings-tests

## Goal
Tests only. This task fixes the "A. Fix recommended" items of docs/orchestraude/drizzle-admin/07-low-findings-security-triage.md: L007, L009, L010, L008, L013, L016 and L018. These are the triage's follow-up candidates 1-3, batched into one task. When it is done:
- the PG/SQLite `views=3000000000` outcome is declared as data, and the SQLite run checks the stored value;
- the hidden-model dashboard test has a positive control;
- the selection-cap tests pin the exact, unfiltered flash list;
- the boundary branches of `parseFieldValue`, the search normalization and the example host guard have table rows.

No source file changes. The message texts come from the post-i18n test API (`const messages = MESSAGES.en`, task 49).

## Scope
### Files to touch
- test/form.test.ts (L007, L009)
- test/auth.test.ts (L010)
- test/actions.test.ts (L008)
- test/query.test.ts (L013)
- test/list.test.ts (L016)
- test/example.test.ts (L018)

### Do not touch
- src/**, example/** (including example/host-guard.ts: if a new row exposes a bug, report the task blocked, do not fix the code here)
- test/helpers/**, test/fixtures/**, every other test file
- The C items of the triage (L001-L006, L011, L012, L014, L015, L017): they are accepted as-is
- README.md, CHANGELOG.md, CLAUDE.md, package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: independent cases are `it.each` rows (one case per row), status and flash assertions are exact, and no assertion is implied by another one in the same test. Line numbers below are from the triage (commit 2a80a06); after task 49, find the code by content.

- **L007 + L009** (test/form.test.ts, the test "add: views=3000000000 is rejected on PG (int4) and stored on SQLite", inside `describe.each(dialects)`): replace the ternary and the `if (fixture.name === "pglite")` with a per-dialect expectation declared as data. Use either a lookup keyed by `fixture.name` (`{ pglite: ..., sqlite: ... }`), or two tests with fixed expectations, each running only on its dialect. The expectations:
  - pglite → status 400, and `errorsOf(doc, "views")` contains `messages.invalidInteger`;
  - sqlite → status 303, and the stored `articles` row with title `int4-overflow` has `views` equal to `3000000000` (use the file's existing row helpers, e.g. `rowWhere` / `rowsOf`).

  No `if` on `fixture.name` and no ternary may remain in the assertions. Behavior reference: forms.md `coerce.ts` rule 3 number; test-strategy.md "Security audit fixes", the `form.test.ts` bullet of "Input bounds".
- **L010** (test/auth.test.ts, "lists no link to the hidden model on the dashboard"): in the same test, first request the dashboard with `clientWith({})` and assert that at least one `a` `href` starts with `/admin/authors/`. Then keep the existing `view: false` assertion unchanged. Behavior reference: decision 043; test-strategy.md "Hidden models".
- **L008** (test/actions.test.ts, the two "selection cap" tests): replace `flashes(client, res, "warning")` with the unfiltered `flashes(client, res)`, compared with `toEqual([messages.tooManySelected(500)])`. Also assert the level once. For example, in a single `it` per test, check that the next page's `ul.messagelist` has exactly one `li` and that it has class `warning`. Do not keep the filtered call next to the unfiltered one, because the unfiltered exact list implies it for the text. Behavior reference: routes-handlers.md Actions step 1.
- **L013** (test/query.test.ts, the `parseFieldValue` / `parsePk` `it.each` table): add rows:
  - `["int16 min", int16, "-32768", -32768]`;
  - `["int16 below min", int16, "-32769", null]`;
  - a bigint field without `valueCheck` (SQLite blob bigint), `fieldWith({ kind: "bigint", isInteger: false })`, with `"9223372036854775808"` → `9223372036854775808n` (no int8 bound without `valueCheck`; src/data/query.ts `parseFieldValue` bigint branch).

  Behavior reference: data.md `parseFieldValue`; decision 045 point 1.
- **L016** (test/list.test.ts, "normalizes the search text: %s" `it.each`): add rows:
  - trim: `["trims surrounding whitespace", "%20%20ab%20", "ab"]`;
  - code-point cut: an astral character repeated 201 times, e.g. `"%F0%9F%98%80".repeat(201)` → `"😀".repeat(200)`. A UTF-16 `slice(0, 200)` would give 100 emoji, so this row fails on such a regression.

  Behavior reference: routes-handlers.md List step 2 `q`; decision 045 point 2.
- **L018** (test/example.test.ts, `isAllowedHost` table `[url, bindHost, port, expected]`): add rows:
  - `["http://localhost:3000/", "0.0.0.0", 3000, true]` (wildcard bind with a loopback name);
  - `["http://[2001:db8::1]:3000/", "::", 3000, true]` (IPv6 wildcard with an IPv6 literal, the `h.startsWith("[")` branch);
  - `["http://evil.example:3000/", "::", 3000, false]`;
  - `["http://example.test:3000/", "Example.TEST", 3000, true]` (bind host in upper case);
  - `["https://127.0.0.1/", "127.0.0.1", 443, true]` (https default port 443);
  - `["https://127.0.0.1/", "127.0.0.1", 80, false]` (the default port follows the scheme).

  Behavior reference: example.md `example/host-guard.ts`; decision 048.
- This task adds no new behavior. The new rows are pins and are expected to pass against the current code. If one fails, the code disagrees with the design: stop and report the task blocked with the received value. Do not change the expectation or the code.

## Definition of Done
- [ ] test/form.test.ts: the int4-overflow expectation is data per dialect. `grep -n 'fixture.name === "pglite"' test/form.test.ts` finds no match inside that test. The SQLite run asserts the stored `views` value `3000000000`.
- [ ] test/auth.test.ts: the dashboard hidden-link test also requests the dashboard with `clientWith({})` and finds an `/admin/authors/` link there.
- [ ] test/actions.test.ts: neither selection-cap test calls `flashes(client, res, "warning")`. Both compare the unfiltered `flashes(client, res)` with `[messages.tooManySelected(500)]` and assert the single `li` has class `warning`.
- [ ] Tests (test/query.test.ts): the int16 min, int16 below-min and bigint-without-`valueCheck` rows pass.
- [ ] Tests (test/list.test.ts, both dialects): the trim and astral code-point rows pass.
- [ ] Tests (test/example.test.ts): the six new `isAllowedHost` rows pass.
- [ ] `git diff --name-only` lists only the six test files and this task file. `git diff src example` is empty. The removed lines of `git diff test/` are only the replaced assertions of L007/L009 (form.test.ts) and L008 (actions.test.ts), plus import-line additions under decision 041.
- [ ] scripts/verify.sh passes

## References
- Triage: docs/orchestraude/drizzle-admin/07-low-findings-security-triage.md (A items, follow-up candidates 1-3)
- Findings: docs/orchestraude/drizzle-admin/07-low-findings-security.md (L007, L008, L009, L010, L013, L016, L018 details)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#Security audit fixes (decisions 042-048)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (`parseFieldValue`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md (List step 2 `q`; Actions step 1)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md#`example/host-guard.ts` (decision 048)
- Decisions: docs/orchestraude/decisions/043-permission-inheritance-and-hidden-models.md, docs/orchestraude/decisions/045-request-input-bounds.md, docs/orchestraude/decisions/048-example-host-guard-prepack-changelog.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
