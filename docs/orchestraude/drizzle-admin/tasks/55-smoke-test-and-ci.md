---
id: 55-smoke-test-and-ci
depends_on: [54-package-metadata-and-docs]
status: done
attempts: 0
---
# Task 55: smoke-test-and-ci

## Goal
Release preparation, part 2 (decision 052 points 6, 7, 10-13):
- `scripts/smoke-pack.sh` packs the package and checks the tarball's contents. It installs the tarball into a clean temporary project, type-checks and runs a consumer on better-sqlite3 and PGlite, and `require()`s the package from CommonJS. It is not part of `scripts/verify.sh`.
- `.github/workflows/ci.yml` runs `scripts/verify.sh` and the smoke test on Node 24 (from mise.toml), and the smoke test on Node 22. `.github/dependabot.yml` keeps the SHA-pinned actions up to date.
- CLAUDE.md states the new commands, the layout and the npm name (design README "Project rules affected (Changed 2026-10-09, decision 052)"). The user approved this edit.

There is no publish job and nothing is published.

## Scope
### Files to touch
- scripts/smoke-pack.sh (new, mode 755)
- scripts/smoke/consumer.ts (new)
- scripts/smoke/tsconfig.json (new)
- .github/workflows/ci.yml (new)
- .github/dependabot.yml (new)
- CLAUDE.md (sections "Overview", "Commands", "Layout" only)

### Do not touch
- scripts/verify.sh. The smoke test is not added to it. `pnpm test` / vitest config also stay as they are.
- package.json, pnpm-lock.yaml, README.md, CHANGELOG.md (task 54), mise.toml, tsconfig.json, tsconfig.build.json, biome.json, vitest.config.ts, .gitignore
- src/**, test/**, example/**
- CLAUDE.md sections other than "Overview", "Commands" and "Layout". "Conventions", "Workflow for agents", "Security rules", "Design principles" and "Where things live" stay verbatim.
- docs/** (except this task's History)
- No publish job, no secrets, no `permissions` wider than `contents: read`, no workflow other than ci.yml.
- If smoke-node22 fails, do not change `engines`, `--ignore-scripts` or the `smoke-node22` job (decision 052 point 12; see "Post-push check").
- Do not run `npm publish`, push or commit.

## Implementation notes
release-checks.md is normative for all five new files. Follow it step by step.
- **scripts/smoke-pack.sh**: steps 1-10 of release-checks.md "`scripts/smoke-pack.sh`", in order, including 6a (tarball content) and 9a (`require()` check).
  - Header and `cd` as in scripts/verify.sh.
  - Step 2, the mise re-exec: when `mise` is on `PATH` and `SMOKE_PACK_UNDER_MISE` is unset, run `exec env SMOKE_PACK_UNDER_MISE=1 mise exec -- bash scripts/smoke-pack.sh "$@"`. Add the why-comment.
  - Step 5: pass the package name to `node -p` as an argument. Never splice it into the code.
  - The `trap 'rm -rf "$work"' EXIT` is specified by the design and only removes the `mktemp -d` directory the script created. The CLAUDE.md "`gio trash`, not `rm`" rule is about agents deleting repository files, so it does not apply here.
  - Every failure message names the problem (e.g. which tarball entry is missing or unexpected).
  - Make the file executable (`chmod 755`), like scripts/verify.sh.
- **scripts/smoke/tsconfig.json**: exactly the JSON block in release-checks.md.
- **scripts/smoke/consumer.ts**: as release-checks.md "`scripts/smoke/consumer.ts`" describes: imports, shared values, `expectPage`, the SQLite part (mounted in the consumer's own `Hono`), the PGlite part (`admin.fetch`), and the never-called `typeOnly` function with the `@ts-expect-error` line.
  - It prints `ok sqlite` and `ok postgres`.
  - The repository tsconfig does not include `scripts/`, so `pnpm typecheck` does not see this file. Biome still lints and formats it, so `pnpm lint` must pass.
  - Its import of `@sson0-er/drizzle-admin` only resolves in the temporary consumer project.
- **.github/workflows/ci.yml** and **.github/dependabot.yml**: byte-identical to the fenced yaml blocks in release-checks.md, including the comments. Do not change any SHA, version or key. If Biome reports anything for these files, report blocked; biome.json is not changed.
- **CLAUDE.md**: copy the meaning of the design README section "Project rules affected (Changed 2026-10-09, decision 052)" into the existing bullets and keep their style:
  - Overview: add "Published on npm as `@sson0-er/drizzle-admin`; `drizzle-orm` and `hono` are peer dependencies."
  - Commands: add the `scripts/smoke-pack.sh` bullet and the CI/Dependabot bullet, as worded there.
  - Layout: add the `scripts/` / `.github/` / published-contents bullet.
  - If the permission system refuses the edit, finish the rest of the task and report this item as blocked.
- Node 22 is not installed locally (evidence 2026-10-09-tarball-smoke-prototype). An optional local run is `MISE_NODE_VERSION=22 scripts/smoke-pack.sh`. It needs mise to download Node 22. If you run it, record the output in History; it does not replace the post-push check.

## Definition of Done
- [ ] Local run on Node 24: `scripts/smoke-pack.sh` exits 0. Its output contains `v24.21.0` (the `node --version` line), `ok sqlite`, `ok postgres`, `ok require` and `smoke-pack: ok`. Paste these lines in History.
- [ ] Negative type check, run once: with the `@ts-expect-error` line removed from scripts/smoke/consumer.ts, `scripts/smoke-pack.sh` exits non-zero with a tsc error on the `listDisplay: ["missing"]` line. Restore the line afterwards. History records the error code and that the line was restored.
- [ ] Cleanup, after both runs (the passing one and the failing one):
  - the list printed by `ls -d "${TMPDIR:-/tmp}"/tmp.* 2>/dev/null` is the same before and after the runs;
  - no `.tgz` is in the repository.
- [ ] Script static checks:
  - `bash -n scripts/smoke-pack.sh` succeeds;
  - `test -x scripts/smoke-pack.sh` succeeds;
  - `grep -c "smoke-pack" scripts/verify.sh` = 0;
  - if `shellcheck` is installed, it reports nothing for the script. Otherwise History records "shellcheck: 未確認".
- [ ] scripts/smoke/tsconfig.json, .github/workflows/ci.yml and .github/dependabot.yml are each byte-identical to their fenced blocks in release-checks.md (`diff` against the extracted block prints nothing).
- [ ] Workflow static checks:
  - every `uses:` line in ci.yml matches `@[0-9a-f]{40} # v[0-9]+\.[0-9]+\.[0-9]+$`;
  - `grep -c "permissions:"` = 1 and `grep -c "contents: read"` = 1;
  - `grep -cE "secrets\.|publish"` = 0.
- [ ] YAML parse: ci.yml and dependabot.yml are parsed with a locally available parser, for example `python3 -c 'import sys, yaml; [yaml.safe_load(open(f)) for f in sys.argv[1:]]' <files>` if PyYAML is installed, or `actionlint .github/workflows/ci.yml` if installed. History records the tool used. If no parser is available, History records "YAML parse: 未確認"; the byte-identical diff above still applies.
- [ ] CLAUDE.md: Overview, Commands and Layout carry the three changes from the design README "Project rules affected (Changed 2026-10-09, decision 052)", and `git diff CLAUDE.md` touches no other section.
- [ ] Tests: there are no vitest changes (test-strategy.md "Release preparation": the smoke script and the workflow have no unit tests; the local runs above are their checks). `git diff --name-only test/` is empty.
- [ ] `git status --short` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes (Biome lints consumer.ts, the tsconfig and any file it covers under `.github/`).
- [ ] History records the post-push check below as "pending (user)". The task is done when the items above pass; the post-push check is reported separately.

## Post-push check (user; 未確認 until the first CI run)
This cannot run locally. After the user pushes to `main` (or opens a pull request), the first run of workflow "CI" is checked and recorded in this task's History:
- job `verify`: green;
- job `smoke-node22`: green, and its `node --version` line shows `v22.x` (proves that `MISE_NODE_VERSION` reaches mise-action);
- whether mise needed `mise trust`.

How failures are handled (release-checks.md "Rules", decision 052 point 12):
- If one of the two unverified mechanics fails (`MISE_NODE_VERSION` propagation, `mise trust`), the fix goes into ci.yml in a follow-up attempt and is recorded in History. release-checks.md is then updated by the orchestrator.
- Any other failure of `smoke-node22` makes the task blocked, with the failing output. Examples: better-sqlite3 not loading on Node 22 under `--ignore-scripts`, a page check, the `require()` check. `engines`, `--ignore-scripts` and the job stay unchanged until a new decision exists.
- The first Dependabot pull request (monthly) is not part of this check.

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/release-checks.md (whole file: smoke script steps, consumer, tsconfig, ci.yml, dependabot.yml, Rules, Errors)
- Design: docs/orchestraude/drizzle-admin/03-design/README.md#Project rules affected (Changed 2026-10-09, decision 052)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md#Release preparation (decision 052)
- Design: docs/orchestraude/drizzle-admin/03-design/questions.md (Resolved: Q16, Q17, Q18)
- Design: docs/orchestraude/drizzle-admin/01-requirements.md (Scope, 2026-10-09 release-preparation note: CI in scope, publishing out of scope)
- Decision: docs/orchestraude/decisions/052-release-preparation-and-ci.md (points 6, 7, 9-13)
- Evidence: docs/orchestraude/evidence/2026-10-09-tarball-smoke-prototype.md, docs/orchestraude/evidence/2026-10-09-github-actions-pinning.md, docs/orchestraude/evidence/2026-10-09-dependabot-sha-pins.md, docs/orchestraude/evidence/2026-10-09-require-esm.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

### Attempt 1: done (implementation)
- Local run on Node 24, `scripts/smoke-pack.sh` exit 0, output lines: `v24.21.0`, `ok sqlite`, `ok postgres`, `ok require`, `smoke-pack: ok`.
- Negative type check (run once, `@ts-expect-error` line removed): exit 2, `consumer.ts(72,66): error TS2322: Type '"missing"' is not assignable to type 'ColumnKey<SQLiteTableWithColumns<...`. The line was restored afterwards (one `@ts-expect-error` present).
- Cleanup: `ls -d /tmp/tmp.*` lists nothing before and after both runs (TMPDIR unset); no `.tgz` in the repository.
- Static checks: `bash -n` ok, `test -x` ok, `grep -c smoke-pack scripts/verify.sh` = 0. shellcheck: 未確認 (not installed).
- `diff` of tsconfig.json, ci.yml and dependabot.yml against the fenced blocks in release-checks.md prints nothing. Workflow checks: all `uses:` match the SHA + `# vX.Y.Z` pattern, `permissions:` = 1, `contents: read` = 1, `secrets.|publish` = 0.
- YAML parse: PyYAML `yaml.safe_load` on ci.yml and dependabot.yml, ok.
- CLAUDE.md: the four bullets of the design README section (Overview, two in Commands, Layout) added; no other section changed.
- Optional local Node 22 run (`MISE_NODE_VERSION=22 scripts/smoke-pack.sh`, mise downloaded node 22.23.3): exit 0; `v22.23.3`, `ok sqlite`, `ok postgres`, `ok require`, `smoke-pack: ok`. This does not replace the post-push check.
- Biome (verify) formatted the consumer import order (`pgTable, text as pgText, serial`); `scripts/verify.sh` passes. No vitest changes.
- Post-push check: pending (user).
- Review round 1: high 0, medium 0, low 5 (quality: text parameter shadows helper; spec: misleading tarball-count message; tests: 3 low). Post-push check pending (user): first CI run incl. Node 22. Done.
- Post-push check (2026-10-09): CI run 37932078402 succeeded. verify job on Node 24.21.0 (1742 passed, 5 skipped; smoke-pack ok) and smoke-node22 on Node 22.23.3 (ok sqlite / postgres / require). Dependabot run succeeded with no PRs.
