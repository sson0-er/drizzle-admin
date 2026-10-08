---
id: 17a-test-pglite-stability
depends_on: [08-db-helpers-and-repository, 17-forms-coerce-validate]
status: done
attempts: 0
---
# Task 17a: test-pglite-stability

## Goal
`scripts/verify.sh` passes deterministically: PGlite-backed tests no longer time out when vitest runs test files in parallel. Behavior of `src/` and every test assertion stay unchanged.

Background (user-approved follow-up): PGlite instances time out during startup under parallel file execution with vitest's default 5 s timeouts. Observed failures: `test/errors.test.ts` "classifies real driver errors" and `test/repository.test.ts`; both pass when run alone. 3 of 4 full runs failed during task 17; task 15 attempt 1 failed the same way.

## Scope
### Files to touch
- vitest.config.ts
- test/helpers/db.ts (only if a config-only change is not sufficient; see notes)
### Do not touch
- src/** (no changes at all)
- test/**/*.test.ts, test/**/*.test.tsx (no changes to assertions, test names, or test structure)
- test/helpers/app.ts, test/helpers/html.ts, test/fixtures/**
- package.json (no new dependencies, no changes to the `test` script), pnpm-lock.yaml
- scripts/verify.sh, mise.toml, tsconfig*.json, biome.json
- docs/** (except this task's History)

## Implementation notes
- First reproduce: run `scripts/verify.sh` (or `pnpm test`) several times on the unchanged tree and record in History how many runs failed and which tests timed out. This is the baseline the fix is judged against.
- Where the time goes: `test/helpers/db.ts` `setupPglite()` does `new PGlite()` (WASM startup) plus DDL and fixture inserts on every `setup()` call. Callers invoke `setup()` inside test bodies (`test/errors.test.ts` `make()`, `test/repository.test.ts`) and through `makeAdmin` in `test/helpers/app.ts` (used from tests and hooks in `test/list.test.ts`, `test/pages.test.ts`, `test/headers.test.ts`). So both `testTimeout` and `hookTimeout` are relevant.
- Options to evaluate, in order of preference (simplest that makes 5 consecutive runs pass wins):
  1. Raise `test.testTimeout` and `test.hookTimeout` in `vitest.config.ts` to a bounded value (e.g. 20000-30000 ms). Do not use 0 or an unbounded value; a real hang must still fail.
  2. Limit concurrency in `vitest.config.ts` (vitest 5 options such as `test.maxWorkers` or `test.fileParallelism`). Prefer capping workers over disabling file parallelism entirely; may be combined with option 1.
  3. Share/reuse PGlite instances in `test/helpers/db.ts`. Only if 1 and 2 do not reach the DoD. Constraints if chosen: the exported API (`dialects`, `DialectFixture`, `SetupResult`, `FixtureSchema`) stays identical; every `setup()` still yields fresh tables and exactly the fixture rows (test-strategy.md "Helpers"); `queryCount()` still counts only queries issued after seeding; several `setup()` results can be open at the same time within one test (`test/errors.test.ts` keeps an `open` list), so a shared instance must never be reset or closed while another live result uses it; `close()` must leave no instance running at the end of the run.
- Check the option names against the installed vitest version (`node_modules/vitest`, 5.0.3) rather than older docs; e.g. `poolOptions.threads.maxThreads` is not the vitest 5 spelling.
- Add an English comment in `vitest.config.ts` directly above the changed option(s) stating why: PGlite WASM startup per `setup()` exceeds the default 5 s timeout when test files run in parallel. If `test/helpers/db.ts` changes, add a comment there explaining the reuse and its isolation guarantee.
- Do not mark tests with `retry`, `.skip`, or `.sequential` to hide the failures.

## Definition of Done
- [ ] Baseline recorded in History: number of failing runs out of at least 3 runs of `scripts/verify.sh` on the unchanged tree, and the names of the timed-out tests.
- [ ] `scripts/verify.sh` run 5 times consecutively after the change (e.g. `for i in 1 2 3 4 5; do scripts/verify.sh || break; done`) exits 0 every time; History records the 5 results and the wall-clock duration of one `pnpm test` run before and after the change.
- [ ] `vitest.config.ts` contains an English comment directly above each changed option that names PGlite startup under parallel test files as the reason.
- [ ] Any timeout set in `vitest.config.ts` is a finite number greater than 5000 (no `0`, no `Infinity`).
- [ ] `git diff --stat` shows changes only in `vitest.config.ts`, optionally `test/helpers/db.ts`, and this task file.
- [ ] `vitest.config.ts` does not set `retry`, `bail`, or `exclude`/`include` changes that drop any existing test file (`pnpm test` reports the same number of test files as the baseline run).
- [ ] Tests: the existing suites `test/errors.test.ts` and `test/repository.test.ts` pass unchanged in each of the 5 full runs (no new test file is required; this task changes test infrastructure only).
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Helpers": fresh tables per `setup()`, `queryCount` semantics)
- Code: test/helpers/db.ts (`setupPglite`), vitest.config.ts, test/errors.test.ts (`make()` and the `open` list), test/helpers/app.ts (`makeAdmin` calls `fixture.setup()`)
- Evidence: task 15 History attempt 1 (PGlite startup timeout in test/errors.test.ts under parallel load); user report during task 17 (3 of 4 full runs failed)

## History

### Attempt 1
- Baseline (unchanged tree, `scripts/verify.sh` x3, 23 test files each): 1 of 3 runs failed (runs 1 and 2 passed, 47 s and 48 s vitest duration; run 3 failed, 59 s). Timed-out tests in run 3 (both "Test timed out in 5000ms"): `test/errors.test.ts` > data/errors (pglite) > classifies real driver errors; `test/repository.test.ts` > repository (pglite) > list > returns the total and rows.
- Change: `vitest.config.ts` sets `testTimeout: 30_000` and `hookTimeout: 30_000` (option 1), each with an English comment naming PGlite startup under parallel files. No `test/helpers/db.ts` change, no concurrency cap, no retry/bail/include changes.
- After (`scripts/verify.sh` x5 consecutively): 5 of 5 exit 0, 23 test files each. Vitest duration per run: 54.7 s, 53.7 s, 50.4 s, 49.8 s, 54.2 s (before: 46.6 s, 48.1 s, 58.6 s; the timeout does not change speed, it only stops slow startups from failing).
