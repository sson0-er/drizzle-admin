---
id: 33-security-test-fixes
depends_on: [28-fk-reference-view-permission, 30-cookie-deletion-and-head-guard]
status: done
attempts: 0
---
# Task 33: security-test-fixes

## Goal
The security tests can fail when the protection they check breaks:
- the delete-refusal test targets a row that a bypassed gate would really delete;
- the 403-matrix controls no longer mutate rows other tests rely on;
- the XSS test covers attribute breakout;
- the trailing-slash guard tests cover the whole allowlist and the redirect cases listed in test-strategy.md;
- the two `pages.test.ts` cases that ignored the dialect run on both dialects.

Covers L044, L089, L096, L053, L086, L092, L091. Test-only task.

## Scope
### Files to touch
- test/auth.test.ts
- test/pages.test.ts
### Do not touch
- src/** (if a new case fails against the current code, stop, report the case and the observed response in History, and leave the code unchanged)
- test/helpers/** and test/fixtures/** (create the rows a test needs inside that test)
- docs/** (except this task's History), CLAUDE.md, README.md, mise.toml, package.json
- Do not commit.

## Implementation notes
- L044 / L089, "leaves the data alone when delete is refused" (auth.test.ts around line 478). Author 1 owns articles, so the FK alone blocks its deletion and the test can never fail. Insert a fresh author with no articles through `t.db` (for example `name: "deletable-<n>"`, `email: "deletable-<n>@example.com"`). Send the denied `POST /admin/authors/<id>/delete/` and the denied `POST /admin/authors/` with `action=delete_selected`, `_selected=<id>`, `_confirm=1`. Then assert, by a DB query or by a 200 `GET /admin/authors/<id>/change/` from an allowed client, that the row still exists.
- L096, 403 matrix controls (around line 467):
  - Controls that delete must target a row created for that case, not author 1.
  - Controls must assert the exact expected status instead of `not.toBe(403)` (CLAUDE.md convention): 200 for the GET pages, 303 for add / change / delete POSTs. For `delete_selected` without `_confirm` the control answers 200 (the confirmation page).
  - The change-POST case asserts that author 1's stored row is unchanged after the denied POST. Compare a DB read before and after.
  - The allowed change-POST control writes `authorForm` to author 1. Either point it at a dedicated row, or confirm in History that `authorForm` leaves the values that later tests read unchanged.
- L053, XSS (around line 580): add a second payload `"><script>alert(1)</script>`, for example as an it.each over both payloads. On the change page, the parsed tree has no `script` element inside `form#model-form`, and `input[name=name]` has a `value` attribute equal to the payload.
- L086 / L092, trailing-slash guard (`pages.test.ts`, `describe("trailing-slash redirect guard")`):
  - add to the `basePath: "/"` list: `/%20/evil.example`, `/%7f/evil.example`, `/a%20b`;
  - add to the `basePath: "/admin"` list: `/admin/%20/evil.example`, `/admin/%7f/evil.example`, `/admin/a%20b`, `/admin///evil.example`;
  - for every path except the `%0a` / `%0d` ones, also assert `Content-Type` contains `text/html` and the body has an `h1` (layout 404). If `%7f` turns out to behave like LF/CR (Hono's plain 404), assert only status and missing `Location` for it and record the observation in History;
  - add 301 cases (it.each): with `basePath: "/"`, `/users?a=1` → `Location: /users/?a=1` and `/authors?x=1` → `/authors/?x=1`; with `basePath: "/admin"`, `/admin/users?a=1` → `/admin/users/?a=1` and `/admin?a=1` → `/admin/?a=1`. Skip any case an existing test already asserts exactly, and list the skips in History.
- L091: in "serves the dashboard with a session cookie" and "rejects a POST without a session cookie even when a token is sent", pass the loop's `fixture` instead of `dialects[0]`.
- CLAUDE.md conventions apply.

## Definition of Done
- [ ] Tests: `test/auth.test.ts`, "leaves the data alone when delete is refused" targets a freshly inserted author with no articles, sends `delete_selected` with `_confirm=1`, and asserts that the row still exists.
- [ ] Tests: `test/auth.test.ts`. No control request in the 403 matrix deletes author 1. Every control asserts an exact status. The change-POST case asserts that the row is unchanged after the 403.
- [ ] Tests: `test/auth.test.ts`. The XSS change-page test covers `"><script>alert(1)</script>`: no `script` element in the form, and the input `value` attribute equals the payload.
- [ ] Tests: `test/pages.test.ts`:
  - the guard lists contain the `%20`, `%7f`, `a%20b` and `/admin///evil.example` paths above, and the non-LF/CR paths assert a `text/html` 404 with an `h1`;
  - the four 301-with-query cases are asserted;
  - the two external-auth cases inside `describe.each(dialects)("app shell pages ($name)")` call `makeAdmin(fixture, ...)` instead of `makeAdmin(dialects[0] ...)`. Uses of `dialects[0]` outside that describe are unchanged.
- [ ] No file under `src/` is changed.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (Integration coverage: "Trailing slash, open-redirect guard"; §10 rows "XSS" and "Permissions in routes")
- Decisions: docs/orchestraude/decisions/029-trailing-slash-redirect-guard.md
- Findings: docs/orchestraude/drizzle-admin/05-low-findings.md (L044, L053, L086, L089, L091, L092, L096 details)

## History

- Implemented (test-only; src, helpers and fixtures untouched).
- 403 matrix: every case now creates its own author without articles (`deletable-<n>`) and the add/change forms use unique names (`added-<id>`, `changed-<id>`). The allowed change-POST therefore no longer writes `authorForm` to author 1. Each case asserts the stored row is unchanged after the denied request, and the control asserts the exact status (200 for GET pages and `delete_selected` without `_confirm`, 303 for add/change/delete POSTs).
- "leaves the data alone when delete is refused": two fresh authors, denied delete page POST and denied `delete_selected` with `_confirm=1` (both 403), both rows asserted by DB query.
- XSS: `it.each` over `<script>alert(1)</script>` and `"><script>alert(1)</script>`; no `script` in `form#model-form`, field value equals the payload (input `value` attribute or textarea text, as before, since pglite renders text as a textarea).
- Guard lists: added the requested paths. `%7f` behaves like the other control-free paths: 404 with `text/html` and an `h1`, no `Location`. Only `%0a`/`%0d` stay in the status-and-Location-only `plain` lists.
- 301 cases: skipped `/users?a=1` with basePath `/` (already asserted by "still redirects an ordinary unslashed path with basePath /"); added `/authors?x=1`, `/admin/users?a=1`, `/admin?a=1`.
- L091: both external-auth cases in "app shell pages" use `fixture`.
- No exports or props added. verify.sh passes.
