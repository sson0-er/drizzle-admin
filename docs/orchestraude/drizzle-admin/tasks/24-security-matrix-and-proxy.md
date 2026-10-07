---
id: 24-security-matrix-and-proxy
depends_on: [23-login-logout-and-auth-guard]
status: pending
attempts: 0
---
# Task 24: security-matrix-and-proxy

## Goal
The remaining §10 items have integration tests: permissions enforced in routes (403 and hidden controls), XSS escaping, and reverse-proxy behavior with `publicOrigin`. The example works after login. This completes phase 5.

## Scope
### Files to touch
- test/auth.test.ts (add the permission and XSS cases)
- test/proxy.test.ts (new)
- test/example.test.ts (add the phase-5 part)
- src/routes/{dashboard,list,actions,form,delete}.ts and src/views/*.tsx: only to fix a permission or hidden-control defect that these tests reveal (record each fix in History)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/auth/**, src/routes/middleware.ts, src/routes/context.ts, src/routes/index.ts, src/data/**, src/forms/**
- test/helpers/**, test/fixtures/**

## Implementation notes
- Permission rules: `interfaces/routes-handlers.md` (List step 6, Actions, Add, Change, Delete) and `interfaces/auth.md#permissionsts`. Custom actions need `change` (decision 016); `delete_selected` needs `delete`. A change page without `change` is read-only with no save buttons (decision 013 item 1).
- Proxy: `publicOrigin: "https://admin.example.com"`, requests to `http://internal:3000/admin/...` (pass full URLs to `admin.fetch`). Expected behavior: test-strategy.md §10 row "Reverse proxy".
- XSS: insert an author whose `name` is `<script>alert(1)</script>` and register a formatter returning `<b>x</b>`; assert on the parsed tree (task 11 `html.ts`).

## Definition of Done
- [ ] Tests: `test/auth.test.ts` (`describe.each(dialects)`) verifies, for each permission set to `false`, 403 on its routes: `view` → list GET and change GET; `add` → add GET and POST; `change` → change POST; `delete` → delete GET and POST, and bulk `delete_selected` POST; and that the dashboard `a.addlink`, the list `a.addlink`, the change page save buttons and `a.deletelink`, and `delete_selected` in `select[name=action]` are absent when the respective permission is false.
- [ ] Tests: `test/auth.test.ts` verifies custom actions: with `change: false` and `delete: true` the custom action is not in `select[name=action]` and its POST → 403; with `change: true` it runs (303 and its flash); a `view`-only user's change page has no `button[name=_save]`.
- [ ] Tests: `test/auth.test.ts` verifies XSS: the list and change pages render `<script>alert(1)</script>` as text (no `script` element other than the select-all script in the parsed tree) and the formatter's `<b>x</b>` produces no `b` element.
- [ ] Tests: `test/proxy.test.ts` (`describe.each(dialects)`) with `publicOrigin: "https://admin.example.com"` and requests to `http://internal:3000/admin/...` verifies: GET Set-Cookie for `da_session` and `da_flash` has `Secure`; POST with `Origin: https://admin.example.com` and a valid token → 303; POST with `Origin: http://internal:3000` and no `Sec-Fetch-Site` → 403; POST with `Sec-Fetch-Site: same-origin` and no Origin passes the Origin check (not a 403 from it); every `Location` header in these responses starts with `/`.
- [ ] Tests: `test/example.test.ts` additionally verifies the example login page → 200, and after logging in as `admin` with the test password, the dashboard and every model list → 200.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "§10 test matrix" rows: Reverse proxy, XSS, Permissions in routes; row "example")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes-handlers.md
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (sections "session.ts", "csrf.ts", "permissions.ts")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (Location headers are path-only)
- Decisions: docs/orchestraude/decisions/016-custom-action-permission.md, 017-public-origin.md, 013-unspecified-page-behaviors.md (item 1)

## History
