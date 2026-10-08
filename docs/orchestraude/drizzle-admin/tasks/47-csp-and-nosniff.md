---
id: 47-csp-and-nosniff
depends_on: [43-instance-bound-cookie-keys]
status: pending
attempts: 0
---
# Task 47: csp-and-nosniff

## Goal
Security audit fixes, part 5 (response headers, decision 044): every response that passes through `securityHeaders` (pages, redirects, 401/403/404 pages, `onError` 500 pages and the stylesheet) also carries `X-Content-Type-Options: nosniff` and a `Content-Security-Policy`:
- builtin mode: `default-src 'none'; script-src 'sha256-<SELECT_ALL_SCRIPT_SHA256>'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
- external mode: the same without the `form-action 'self'; ` directive.

The one inline script stays inline and is allowed by its hash. `SELECT_ALL_SCRIPT_SHA256` is a literal constant next to `SELECT_ALL_SCRIPT`, and a unit test recomputes it, so editing the script without updating the hash fails `pnpm test`.

Source findings: docs/orchestraude/drizzle-admin/security-audit/views.findings.json, docs/orchestraude/drizzle-admin/security-audit/dynamic.md (item 7).

## Scope
### Files to touch
- src/static/select-all.ts (add `SELECT_ALL_SCRIPT_SHA256`; `SELECT_ALL_SCRIPT` unchanged)
- src/routes/middleware.ts (only `securityHeaders`, which becomes the factory `securityHeaders(csp: string)`, plus `buildCsp(authMode)`)
- src/routes/index.ts (only the `app.use("*", securityHeaders...)` line and the import)
- test/headers.test.ts, test/views.test.ts

### Do not touch
- `initVars`, `sessionMiddleware`, `userMiddleware`, `authGuard`, `csrfToken` in src/routes/middleware.ts; the middleware order and the route table in src/routes/index.ts
- src/views/** (no markup change; views render no other inline script, `style` attribute or inline handler, views.md "Static modules"), src/static/admin-css.ts
- src/admin.ts, src/types.ts (no `loginUrl` validation, decision 044 point 1), src/auth/**
- Every other file under src/**, example/**, test/helpers/**, test/fixtures/**, every other test file
- README.md, CHANGELOG.md, CLAUDE.md (task 48), package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Do not delete, weaken or skip an existing assertion. In test/headers.test.ts, adding assertions to the shared `expectHardened` helper is allowed.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact header values.

- **Hash constant** (views.md "Static modules"): `export const SELECT_ALL_SCRIPT_SHA256 = "<base64>"`, the base64 SHA-256 of the UTF-8 bytes of `SELECT_ALL_SCRIPT`, written as a literal string (no runtime hashing; src/ must not import `node:crypto`). The design gives the current value `v/peDHOfIZWrfvqqPHbyzhkt2GMZ+0UvE0ARRSfmSAU=`. The unit test below is authoritative: if the computed hash differs, use the computed value and record both values in History. Add a short comment that whoever edits the script must update the constant.
- **Policy** (routes.md "Middleware order" step 1):
  - `buildCsp(authMode: "builtin" | "external"): string` in src/routes/middleware.ts returns the builtin string above, or the external string without `form-action 'self'; `. Planner choice: routes.md calls `buildCsp` module-private but also says the policy is built once in `buildApp` (src/routes/index.ts) and passed to `securityHeaders(csp)`. To keep both the `securityHeaders(csp)` signature and the build-once rule, export `buildCsp` and call `app.use("*", securityHeaders(buildCsp(config.authMode)))` in `buildApp`. Record this export in History (CLAUDE.md: exports not in the design are recorded so the design is updated).
  - `securityHeaders(csp)`: after `await next()`, set `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: <csp>` unconditionally, then `Cache-Control: no-store` only when the response has no `Cache-Control` (unchanged rule).
- **Tests** (test-strategy.md: the `views.test.ts` bullet of "Security audit fixes" and the §10 row "Response headers"):
  - test/views.test.ts: `createHash("sha256").update(SELECT_ALL_SCRIPT, "utf8").digest("base64")` (from `node:crypto`) equals `SELECT_ALL_SCRIPT_SHA256`. Put it next to the existing "script text equals `SELECT_ALL_SCRIPT`" case.
  - test/headers.test.ts, both dialects: `expectHardened` also asserts `X-Content-Type-Options` is `nosniff` and `Content-Security-Policy` equals exactly `` `default-src 'none'; script-src 'sha256-${SELECT_ALL_SCRIPT_SHA256}'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'` ``. The existing cases then cover the 200 page, the 301 redirect, the 404 page, both 403 pages and the static CSS. Add:
    - an `onError` 500: an admin from `makeAdmin` with `kv: { formatters: { value: () => { throw new Error("boom"); } } }`, `GET /admin/kv/` → 500 with the hardened headers. Spy on `console.error` and restore it, so the expected log does not clutter the output.
    - external mode: `makeAdmin(fixture, { config: { auth: { getUser: async () => TEST_USER, loginUrl: "https://sso.example.com/login" } } })`, `GET /admin/` → 200, `Content-Security-Policy` equals exactly `` `default-src 'none'; script-src 'sha256-${SELECT_ALL_SCRIPT_SHA256}'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'` `` and does not contain `form-action`; `X-Content-Type-Options` is `nosniff`.
- Write the tests first and run them against the unchanged code; they must fail there (no `SELECT_ALL_SCRIPT_SHA256` export, header `null`). Record that in History.
- Manual check (optional, report as run or 未確認): `pnpm example`, open the list page in a browser with devtools, and confirm the console shows no CSP violation for the select-all script and the "select all" checkbox works.

## Definition of Done
- [ ] src/static/select-all.ts exports `SELECT_ALL_SCRIPT_SHA256` as a string literal; `SELECT_ALL_SCRIPT` is byte-identical to before.
- [ ] `securityHeaders` is a factory taking the policy string; `buildApp` builds the policy once with `buildCsp(config.authMode)`. History records the `buildCsp` export.
- [ ] Tests (test/views.test.ts): the recomputed hash equals `SELECT_ALL_SCRIPT_SHA256`.
- [ ] Tests (test/headers.test.ts, both dialects): the 200 page, 301 redirect, 404 page, token 403, Origin 403, `onError` 500 and static CSS responses each have `X-Content-Type-Options: nosniff` and the exact builtin policy; the external-mode page has the exact external policy and no `form-action`. The static CSS keeps `Cache-Control: public, max-age=31536000, immutable`.
- [ ] History records that the new tests failed against the pre-change code.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md ("Middleware order" step 1; "Error handling")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md#Static modules
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md ("Security audit fixes (decisions 042-048)", `views.test.ts` bullet; §10 row "Response headers")
- Decisions: docs/orchestraude/decisions/044-csp-and-nosniff-headers.md, docs/orchestraude/decisions/007-static-assets.md
- Evidence: docs/orchestraude/evidence/2026-10-08-csp-hash-and-form-action.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
