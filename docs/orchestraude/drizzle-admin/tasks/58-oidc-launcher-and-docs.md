---
id: 58-oidc-launcher-and-docs
depends_on: [57-oidc-app-mock-idp-and-flow-test, 55-smoke-test-and-ci]
status: done
attempts: 0
---
# Task 58: oidc-launcher-and-docs

## Goal
OIDC SSO example, part 3 (decision 053 points 3, 8, 11, 13, 14, and the CLAUDE.md lines of the design README "Project rules affected (Changed 2026-10-09, decision 053)"):
- `pnpm example:oidc` runs `tsx example/oidc/launch.ts`. In mock mode it writes the run-time certificate and spawns `example/oidc/server.ts` with `NODE_EXTRA_CA_CERTS` and `OIDC_MOCK_CERT_DIR`. It forwards signals and removes the directory when the child exits. With `OIDC_ISSUER` set it spawns the child with the environment unchanged.
- `example/oidc/server.ts` reads the configuration with `readOidcExampleConfig`, starts the mock IdP in mock mode, and serves the app behind `hostGuard`.
- README "Development" documents the example (a command line plus a `### OIDC example` subsection before `### Changelog`). test/readme.test.ts pins the key texts and the placement.
- CLAUDE.md gains the user-approved Commands, Layout and Security rules lines.

The published package does not change. The user's browser run (Q19) is a post-implementation acceptance check by the user, not part of this task's DoD.

## Scope
### Files to touch
- example/oidc/server.ts (new)
- example/oidc/launch.ts (new)
- package.json (`scripts` only: add `"example:oidc": "tsx example/oidc/launch.ts"` right after `example`)
- README.md (section "Development" only: one line in the command block, one new `### OIDC example` subsection before `### Changelog`)
- test/readme.test.ts (new cases only: one `it.each` and one `it`)
- CLAUDE.md (sections "Commands", "Layout" and "Security rules" only)

### Do not touch
- src/**, every other example/ file (example/oidc/*.ts and app.tsx from tasks 56-57, example/app.ts, example/server.ts, example/host-guard.ts). If one seems to need a change, stop and report it.
- pnpm-lock.yaml (no dependency change; `pnpm install --frozen-lockfile` must still pass), package.json outside `scripts`.
- Every test file other than test/readme.test.ts. Its existing cases stay unchanged, including the 12-heading assertion: do not add a `##` heading to README.md.
- README.md outside "Development". CHANGELOG.md: no entry, because the published files do not change (decision 053 point 11).
- CLAUDE.md sections "Overview", "Design principles", "Where things live", "Workflow for agents" and "Conventions" stay verbatim.
- vitest.config.ts, tsconfig*.json, biome.json, mise.toml, pnpm-workspace.yaml, .gitignore, scripts/**, .github/**.
- docs/** (except this task's History).
- Never write `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized`, `allowInsecureRequests`, `checkServerIdentity`, `strict-ssl`, `strictSsl` or `--insecure` in a scanned file (`src/`, `test/`, `example/`, `scripts/`, `.github/`, package.json and the config files). Never set any of them in a command you run, including when you check the launcher's refusal. That refusal is covered by the `assertTlsVerificationOn` unit rows of task 56. The CLAUDE.md text below names the variable; CLAUDE.md is not scanned.
- Do not commit.

## Implementation notes
Normative: example-oidc.md sections "`example/oidc/server.ts`", "`example/oidc/launch.ts`", "Configuration (environment)", "README text"; project-setup.md "API (commands)" and "README.md outline" paragraph "Changed 2026-10-09 (decision 053)"; design README "Project rules affected (Changed 2026-10-09, decision 053)".

- **server.ts**:
  - `readOidcExampleConfig(process.env)`. On an `Error`, print its message as one line (`console.error(error.message)`) and `process.exit(1)`.
  - Mock mode: `startMockIdp({ ...readLocalhostCert(config.mockCert.dir), port: config.mockCert.port, clientId, clientSecret, redirectUris: [config.oidc.OIDC_REDIRECT_URI] })`, and `issuer = idp.issuer`.
  - Real mode: `issuer = config.issuer`.
  - Use non-null assertions with a short why-comment where the mode guarantees `mockCert` / `issuer` (CLAUDE.md Conventions); no re-narrowing guards.
  - Then `createOidcExampleApp({ secret, oidc: { ...config.oidc, OIDC_ISSUER: issuer }, allow })`; `root = new Hono()`, `root.use("*", hostGuard(config.hostname, config.port))`, `root.route("/", app)`; `serve({ fetch: root.fetch, port, hostname })`.
  - Print `drizzle-admin OIDC demo: http://localhost:<port>/admin/`, then `Mock IdP: <issuer>` in mock mode, then each of `config.notes`.
- **launch.ts**:
  - First `assertTlsVerificationOn(process.env)`. On an `Error`, print its message and exit 1 before anything is generated or spawned.
  - `serverPath = fileURLToPath(new URL("./server.ts", import.meta.url))`. Branch on `selectMode(process.env)`.
  - Mock mode: `writeLocalhostCert()`, then `env = { ...process.env, NODE_EXTRA_CA_CERTS: certPath, OIDC_MOCK_CERT_DIR: dir }`.
  - Spawn with `spawn(process.execPath, ["--import", "tsx", serverPath], { stdio: "inherit", env })`. Pass arguments as an array, with no shell.
  - Forward `SIGINT` / `SIGTERM` to the child and keep waiting.
  - On the child's `exit`, remove `dir` (mock mode) with `rmSync(dir, { recursive: true, force: true })`. Exit with the child's code, or 1 when the child ended by a signal.
  - A `spawn` `error` also removes `dir` and exits 1.
  - The `rmSync` of the launcher's own temp directory is specified by the design. The CLAUDE.md `gio trash` rule is about agents deleting repository files.
- **package.json**: the only change is the `example:oidc` script line. Keep the existing formatting.
- **README.md** (English):
  - In the Development command block, after the two `pnpm example` lines, add exactly `pnpm example:oidc     # OIDC sign-in demo with a local mock IdP; open http://localhost:3000/admin/`.
  - Add `### OIDC example` directly before `### Changelog`, with items 1-4 of example-oidc.md "README text" in that order:
    1. run (including `sign in as \`demo\``, `use localhost, not 127.0.0.1`);
    2. real IdP, with the variables table of example-oidc.md "Configuration (environment)" (the rows as they are; the launcher-only `OIDC_MOCK_CERT_DIR` / `NODE_EXTRA_CA_CERTS` are not rows), the real-mode scopes sentence and the "other `OIDC_*` variables are ignored" sentence;
    3. how it fits together, including the mount warning (`app.mount`, a separate `admin.fetch` or the bridge after the mount makes the browser loop);
    4. the six caveats.
  - Write it as prose and lists in the README's existing style. The README must not contain any of the forbidden names (not scanned, but the caveat only needs to say verification is never turned off and the example refuses to start when the environment disables it).
- **test/readme.test.ts**: planner-added cases (not listed in test-strategy.md; recorded here so the design can be synced), using the "Language" case's regex pattern.
  - `it.each` (CLAUDE.md Conventions: one case per row, no for-loop) "documents %s under the 'OIDC example' heading": match `/^### OIDC example$([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m` and expect the body to contain the row's text. One row per text:
    - `pnpm example:oidc`
    - `OIDC_ISSUER`
    - `OIDC_ALLOWED_SUBJECTS`
    - `OIDC_ALLOWED_EMAIL_DOMAINS`
    - `NODE_EXTRA_CA_CERTS`
    - `http://localhost:3000/admin/`
    - `app.route`
    - `Safari`
  - One `it` "places the OIDC example before the Changelog pointer": the index of `\n### OIDC example\n` is at least 0 and smaller than the index of `\n### Changelog\n`.
  - Run them before the README edit and record in History that they failed.
- **CLAUDE.md**: apply the four bullets of the design README "Project rules affected (Changed 2026-10-09, decision 053)", with the wording given there:
  - Commands: add the `pnpm example:oidc` bullet after the `pnpm example` bullet.
  - Layout: add the `example/oidc/` bullet next to the `example/` bullet.
  - Security rules: add the TLS bullet.
  - Security rules: replace "Every POST passes the Origin check and the `_csrf` token check." with the scoped text naming `POST /oidc/logout`.
  - The user approved these edits. If the permission system refuses the edit, finish the rest of the task and report this item as blocked.
- **Manual run** (test-strategy.md "Not tested: `launch.ts` and `server.ts` …"). Run each once and paste the relevant output lines in History. Use `curl -4` because the servers bind `127.0.0.1`.
  1. Start `mise exec -- pnpm example:oidc` in the background. The startup lines show the demo URL, `Mock IdP: https://localhost:3001` and the notes.
  2. `curl -4 -si http://localhost:3000/admin/` → 302, `Location: /oidc/login?next=%2Fadmin%2F`.
  3. `curl -4 -si 'http://localhost:3000/oidc/login?next=%2Fadmin%2F'` → 302, with `Location` starting `https://localhost:3001/`. The child fetched the IdP discovery over TLS, trusting only the extra CA.
  4. `curl -4 -s --cacert <tmpdir>/drizzle-admin-oidc-*/cert.pem https://localhost:3001/.well-known/openid-configuration` → JSON with `"issuer":"https://localhost:3001"`.
  5. Send `SIGINT` to the launcher. It exits, and the `drizzle-admin-oidc-*` directory it created no longer exists. Record the exit code.
  6. `mise exec -- pnpm exec tsx example/oidc/server.ts` with no `OIDC_*` variables prints `Mock mode needs the generated certificate: start it with "pnpm example:oidc", or set OIDC_ISSUER to use a real IdP.` and exits 1.
  7. `OIDC_ISSUER=https://idp.example mise exec -- pnpm example:oidc` prints `OIDC_CLIENT_ID is required when OIDC_ISSUER is set.` and exits 1, and creates no `drizzle-admin-oidc-*` directory.
  - If a port is in use, set `PORT` / `OIDC_MOCK_PORT` and adjust the URLs. Make sure no process from these runs is left running.

## Definition of Done
- [ ] `node -p "require('./package.json').scripts['example:oidc']"` prints `tsx example/oidc/launch.ts`. `git diff package.json` adds exactly that one line (plus a comma on the `example` line if the format needs it).
- [ ] The published package is unchanged:
  - Before any edit, save the sorted `files[].path` list of `mise exec -- npm pack --dry-run --json` (after `mise exec -- pnpm build`) to the scratchpad.
  - After the task the list `diff`s empty against it. README.md has a new size but the same path.
  - No `.tgz` is left in the repository.
- [ ] `mise exec -- pnpm install --frozen-lockfile` succeeds and `git diff --stat pnpm-lock.yaml` is empty.
- [ ] README.md:
  - `grep -c "^## " README.md` = 12.
  - `grep -n "^### OIDC example$"` shows one line before `^### Changelog$`.
  - The command block contains the `pnpm example:oidc` line verbatim.
  - The subsection contains items 1-4 of example-oidc.md "README text", including the six caveats and the mount warning.
  - `grep -cE "NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized|allowInsecureRequests" README.md` = 0.
- [ ] Tests (test/readme.test.ts): the eight new `it.each` rows "documents … under the 'OIDC example' heading" and the ordering `it` pass. History records that they failed against the pre-task README. `git diff test/readme.test.ts` has no removed lines (decision 041 import-line exception applies).
- [ ] CLAUDE.md contains the `pnpm example:oidc` Commands bullet, the `example/oidc/` Layout bullet, the TLS Security-rules bullet and the scoped "Every POST to the admin (`src/`) …" bullet, worded as in the design README section. `git diff CLAUDE.md` touches only "Commands", "Layout" and "Security rules". Or this item is reported blocked by the permission system.
- [ ] Manual run steps 1-7 were done, and the observed lines (status, `Location`, issuer, exit codes, directory removed or not created) are pasted in History. Any deviation is reported as blocked with the output. No server process from the run is left running.
- [ ] test/tls-verification.test.ts (unchanged) passes; it now also scans server.ts and launch.ts.
- [ ] `git diff --name-only` plus `git status --short` (new files) list only the files in "Files to touch" and this task file.
- [ ] Not a DoD item, recorded as 未確認 in History: the user's browser check (Q19, decision 053 point 14). The user runs `pnpm example:oidc` in Chrome or Firefox, accepts the mock IdP certificate warning, signs in as `demo`, sees the admin with their name and signs out at `/`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md (sections "`example/oidc/server.ts`", "`example/oidc/launch.ts`", "Configuration (environment)", "README text (section "Development", new subsection "OIDC example", before "Changelog")")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md#API (commands)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md#README.md outline (written in phase 6; English) (paragraph "Changed 2026-10-09 (decision 053), by section")
- Design: docs/orchestraude/drizzle-admin/03-design/README.md#Project rules affected (Changed 2026-10-09, decision 053)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md (`hostGuard`, run instructions)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#OIDC example (decision 053) ("Not tested", "Post-implementation user check")
- Design: docs/orchestraude/drizzle-admin/03-design/questions.md (Q19, Q20)
- Decision: docs/orchestraude/decisions/053-oidc-sso-example.md (points 3, 8, 11, 13, 14)
- Evidence: docs/orchestraude/evidence/2026-10-09-oidc-example-runtime-checks.md (`--import tsx`, `localhost` to `127.0.0.1`), docs/orchestraude/evidence/2026-10-09-extra-ca-certs-flow.md, docs/orchestraude/evidence/2026-10-09-secure-cookie-localhost-browsers.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

### Attempt 1 (implementer)
- Outcome: implemented; scripts/verify.sh passes.
- Pack list: `npm pack --dry-run --json` file paths (234, sorted) were identical before and after; no `.tgz` left; `pnpm install --frozen-lockfile` succeeded and `pnpm-lock.yaml` is unchanged.
- Tests first: before the README edit the eight new `it.each` rows and the ordering `it` (9 tests) failed in test/readme.test.ts ("expected null not to be null", "expected -1 to be greater than or equal to 0"); after the edit they pass. No removed lines in `git diff test/readme.test.ts`.
- Planner-added test cases (not in test-strategy.md, design to sync): the `it.each` "documents %s under the 'OIDC example' heading" (8 rows) and the `it` "places the OIDC example before the Changelog pointer".
- Added test/design note: server.ts uses a `biome-ignore lint/style/noNonNullAssertion` comment for the single `config.issuer!` (the mock branch narrows through `config.mockCert`, so it needs no assertion).
- CLAUDE.md: the four bullets were applied with the design README wording, except that the Commands bullet leaves out the trailing "(Changed 2026-10-10: allowlist, Q21)" annotation (a design change note, not rule text). Layout bullet added directly after the `example/` bullet.
- Manual run (PORT=3100, OIDC_MOCK_PORT=3101 because the user may use 3000; loopback only):
  1. `mise exec -- pnpm example:oidc` printed `drizzle-admin OIDC demo: http://localhost:3100/admin/`, `Mock IdP: https://localhost:3101`, the two `Note:` lines and `Sign in at the mock IdP as "demo" ...`. `/tmp/drizzle-admin-oidc-wdhh2c` existed while it ran.
  2. `curl -4 -si http://localhost:3100/admin/` -> `HTTP/1.1 302 Found`, `location: /oidc/login?next=%2Fadmin%2F`.
  3. `curl -4 -si 'http://localhost:3100/oidc/login?next=%2Fadmin%2F'` -> `302 Found`, `location: https://localhost:3101/auth?client_id=drizzle-admin-example&redirect_uri=http%3A%2F%2Flocalhost%3A3100%2Foidc%...`.
  4. `curl -4 -s --cacert <dir>/cert.pem https://localhost:3101/.well-known/openid-configuration` -> JSON with `"issuer":"https://localhost:3101"`.
  5. SIGINT to the launcher node process: the child and launcher exited, the `drizzle-admin-oidc-*` directory no longer existed, ports free. Exit code 1 (the child dies from the forwarded signal, so the launcher exits 1 by design; `pnpm` printed `ELIFECYCLE ... exit code 1`; a second run through `pnpm exec tsx` gave `exit code: 1` from `wait`).
  6. `pnpm exec tsx example/oidc/server.ts` without `OIDC_*` -> `Mock mode needs the generated certificate: start it with "pnpm example:oidc", or set OIDC_ISSUER to use a real IdP.`, exit 1.
  7. `OIDC_ISSUER=https://idp.example pnpm example:oidc` -> `OIDC_CLIENT_ID is required when OIDC_ISSUER is set.`, exit 1, no `drizzle-admin-oidc-*` directory created.
  - No process from the runs is left; the temporary directories are gone.
- 未確認 (not a DoD item): the user's browser check (Q19, decision 053 point 14) in Chrome or Firefox: accept the mock IdP certificate warning, sign in as `demo`, see the admin with the name, sign out at `/`.
- Review round 1: high 0, medium 0, low 1 (security: SIGHUP not handled, cert dir left in /tmp with 0700/0600 modes). User browser check (Q19) pending. Done.
