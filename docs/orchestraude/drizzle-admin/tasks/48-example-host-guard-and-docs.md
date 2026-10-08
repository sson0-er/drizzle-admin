---
id: 48-example-host-guard-and-docs
depends_on: [43-instance-bound-cookie-keys, 44-permission-inheritance-and-hidden-models, 45-key-value-domains-and-identity, 46-search-and-selection-caps, 47-csp-and-nosniff]
status: pending
attempts: 0
---
# Task 48: example-host-guard-and-docs

## Goal
Security audit fixes, part 6 (surroundings and documentation, decision 048 plus the README and CLAUDE.md parts of decisions 042-047):
- The example server rejects requests whose Host header is not the bound host:port (DNS-rebinding protection for the demo with its public default password). `example/host-guard.ts` exports `isAllowedHost` and `hostGuard`; `example/server.ts` serves a root app with the guard in front of the unchanged `createExampleApp` app.
- `package.json` runs `pnpm build` on `prepack` and publishes `CHANGELOG.md`.
- The new `CHANGELOG.md` lists the user-visible changes of decisions 042-047 under `## Unreleased`, including the one-time sign-out.
- README.md describes the new behavior (project-setup.md "security audit fixes" paragraph).
- CLAUDE.md "Security rules" states that cookies are signed with per-instance derived keys and that the CSP hash constant must be updated together with the inline script.

Source findings: docs/orchestraude/drizzle-admin/security-audit/views.findings.json (example Host header, stale `dist`).

## Scope
### Files to touch
- example/host-guard.ts (new)
- example/server.ts
- test/example.test.ts (new describes only)
- package.json (`scripts.prepack`, `files`)
- CHANGELOG.md (new, repository root)
- README.md
- CLAUDE.md (only the "Security rules" section)

### Do not touch
- example/app.ts, example/schema.ts, example/seed.ts (`createExampleApp` stays unchanged, decision 048 point 1)
- src/**, test/helpers/**, test/fixtures/**, every other test file, including test/readme.test.ts
- In package.json: everything except adding `"prepack": "pnpm build"` to `scripts` and `"CHANGELOG.md"` to `files` (no dependency or version change; no `pnpm install`)
- In CLAUDE.md: every section other than "Security rules"; the "Conventions" section stays verbatim
- biome.json, vitest.config.ts, tsconfig*.json, mise.toml
- docs/** (except this task's History)
- Do not delete, weaken or skip an existing assertion.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row.

- **`example/host-guard.ts`** (example.md "`example/host-guard.ts` (decision 048)"): implement `isAllowedHost(requestUrl, bindHost, port)` exactly as specified there (effective port, bracketed IPv6 bind host, loopback names `localhost` / `127.0.0.1` / `[::1]`, wildcards `0.0.0.0` / `[::]`, IP literals `/^\d{1,3}(\.\d{1,3}){3}$/` or starting with `[`). `hostGuard(bindHost, port)` returns `c.text("Forbidden: unexpected Host header", 403)` without calling `next` when the check fails. The text is example code, not a library UI string, so it is not in src/messages.ts.
- **`example/server.ts`** (example.md "`example/server.ts`" bullet "`const app = new Hono() ...`"): `const root = new Hono(); root.use("*", hostGuard(hostname, port)); root.route("/", app);` and `serve({ fetch: root.fetch, port, hostname }, ...)`. The rest (env handling, warnings, printed URL) stays.
- **Tests, test/example.test.ts** (test-strategy.md "Security audit fixes", the `example.test.ts` bullet):
  - `isAllowedHost` it.each `[url, bindHost, port, expected]`: `http://127.0.0.1:3000/`, `http://localhost:3000/` and `http://[::1]:3000/` with bind `127.0.0.1`, port 3000 → true; `http://evil.example:3000/` → false; `http://127.0.0.1:3001/` → false; bind `0.0.0.0`: `http://192.168.1.5:3000/` → true, `http://evil.example:3000/` → false; bind `::1`: `http://[::1]:3000/` → true; bind `example.test`: `http://example.test:3000/` → true, `http://localhost:3000/` → false; bind `127.0.0.1`, port 80: `http://127.0.0.1/` → true.
  - Planner addition (hostGuard behavior): a `new Hono()` with `use("*", hostGuard("127.0.0.1", 3000))` and a `GET /` handler answering `ok`. `app.request("http://evil.example:3000/")` → 403 with body exactly `Forbidden: unexpected Host header`; `app.request("http://127.0.0.1:3000/")` → 200 `ok`.
- **package.json** (project-setup.md commands table row "(lifecycle) `prepack`" and the `files` line): `"prepack": "pnpm build"`; `"files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"]`.
- **CHANGELOG.md** (project-setup.md "CHANGELOG.md (decision 048)"): English, `# Changelog`, then `## Unreleased` with two lists under `### Security` and `### Changed`, holding exactly the items of that paragraph. The sign-out sentence is bold: **every user is signed out once after upgrading**.
- **README.md** (project-setup.md "README.md outline", the paragraph "Changed 2026-10-08: security audit fixes (decisions 042-048), by section"): apply every item to its section: 5 (`secret`, `sessionMaxAgeSec`), 6 (`listDisplay`, `exclude`, `readonlyFields`, `permissions`, `listPerPage`), 7 (500-row selection cap), 8 ("Authentication modes" `next` note, "Cookies" derived key, "CSRF and headers" nosniff and the two CSP strings of routes.md with the host-CSP note, "Permissions" hidden-model 404 and the change/delete-without-view note), 9 (search text, malformed keys), 11 (example Host check). Write the CSP strings with the literal hash `SELECT_ALL_SCRIPT_SHA256` from src/static/select-all.ts.
  - Changelog pointer: test/readme.test.ts pins the exact list of `##` headings, so the pointer to `CHANGELOG.md` must not be a new `##` heading. Put it at the end of the "Development" section, as a sentence or a `### Changelog` subsection.
- **CLAUDE.md "Security rules"** (requested by the orchestrator for this round; decisions 042 and 044):
  - Replace the bullet "Cookies are signed, HttpOnly, SameSite=Lax and Secure per `isSecure`; set and delete share `cookieAttrs`." with: "Cookies are signed with keys derived per instance and per cookie (`deriveCookieKey(secret, cookieName, prefix)`, decision 042); the raw `secret` is passed to no cookie function. They are HttpOnly, SameSite=Lax and Secure per `isSecure`; set and delete share `cookieAttrs`."
  - Add the bullet: "Every response carries the Content-Security-Policy from `buildCsp` and `X-Content-Type-Options: nosniff` (decision 044). When `SELECT_ALL_SCRIPT` changes, update `SELECT_ALL_SCRIPT_SHA256` in the same change (a test recomputes it). A new inline script, `style` attribute or external resource needs a policy change and a decision record."
  - If the permission system refuses the CLAUDE.md edit, leave CLAUDE.md unchanged, finish the rest of the task and report that item as blocked in History.
- **Manual check** (report as run or 未確認): `pnpm example`, then `curl -s -o /dev/null -w "%{http_code}" -H "Host: evil.example:3000" http://127.0.0.1:3000/admin/` → `403`, and the same without the Host override → `302`. Optional: `npm pack --dry-run` lists `CHANGELOG.md` and `dist/index.js`.

## Definition of Done
- [ ] example/host-guard.ts exports `isAllowedHost(requestUrl: string, bindHost: string, port: number): boolean` and `hostGuard(bindHost: string, port: number): MiddlewareHandler`; example/server.ts passes `root.fetch` (with `hostGuard(hostname, port)`) to `serve`.
- [ ] Tests (test/example.test.ts): the 11 `isAllowedHost` rows and the two `hostGuard` cases pass; the existing example tests pass unchanged.
- [ ] `node -p "require('./package.json').scripts.prepack"` prints `pnpm build`; `node -p "require('./package.json').files.join()"` prints `dist,README.md,LICENSE,CHANGELOG.md`.
- [ ] CHANGELOG.md starts with `# Changelog`, has `## Unreleased` with `### Security` and `### Changed`, and contains every item of project-setup.md "CHANGELOG.md (decision 048)", including the bold sign-out sentence.
- [ ] README.md contains each of `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, `form-action 'self'`, `34560000` and `CHANGELOG.md` at least once (`grep -F`), and its "Development" section mentions the Host check. History lists, for every item of the project-setup.md security-audit paragraph, the README section where it was applied. test/readme.test.ts passes unchanged.
- [ ] CLAUDE.md "Security rules" contains the two texts above; `git diff CLAUDE.md` touches only that section (or History reports the edit as blocked by permissions).
- [ ] History records that the new example tests failed before example/host-guard.ts existed, and whether the manual `curl` check was run (result) or is 未確認.
- [ ] `git diff --name-only` (plus `git status --short` for the two new files) lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md (`example/server.ts`, `example/host-guard.ts`)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md (commands table, `package.json`, "CHANGELOG.md (decision 048)", "README.md outline")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md ("Middleware order" step 1, the two CSP strings)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md ("Security audit fixes (decisions 042-048)", `example.test.ts` bullet)
- Decisions: docs/orchestraude/decisions/048-example-host-guard-prepack-changelog.md; for README and CHANGELOG content also 042, 043, 044, 045, 046, 047 in docs/orchestraude/decisions/
- Evidence: docs/orchestraude/evidence/2026-10-08-prepack-lifecycle.md, docs/orchestraude/evidence/2026-10-08-hono-head-cookie-body-node-server.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
