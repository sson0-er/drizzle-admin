---
id: 06-example-app
depends_on: [05-register-and-finalize]
status: pending
attempts: 0
---
# Task 06: example-app

## Goal
The `example/` demo (users, posts, tags) builds with seed data and all registrations succeed. `createExampleApp()` can be used by tests without opening a port, and `pnpm example` starts a server. This completes phase 1.

## Scope
### Files to touch
- example/schema.ts, example/seed.ts, example/app.ts, example/server.ts
- test/example.test.ts (phase-1 part)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/** (the example imports `../src/index.js` only)
- package.json (the `example` script already exists from task 01)

## Implementation notes
- Everything is specified in `interfaces/example.md`: schema, `createSchema` (constant DDL via `sqlite.exec`), deterministic seed (5 users with one inactive, 60 posts over authors/statuses/dates incl. today / past 7 days / this month, 8 tags), `createExampleApp({ secret, adminPassword })`, registrations (users with actions `deactivate` (confirm) and `activate`, posts, tags) and server behavior.
- Seed dates relative to "today" are computed from `new Date()` at seed time, so the filters show data. "Deterministic" means no randomness.
- `server.ts` reads `ADMIN_SECRET`, `ADMIN_PASSWORD`, `PORT`, prints the URL and login hint, and warns when the default password is used. Only `server.ts` touches `process.env` and listens.
- At this stage `admin.app` is the stub from task 05, so only the outer `GET /` redirect is observable.
- Manual check (not part of `pnpm test`): run `pnpm example`, request `GET http://localhost:3000/` (e.g. `curl -si`), confirm a 302 with `Location: /admin/`, stop the server. Record in History whether this check was run and its result.

## Definition of Done
- [ ] Tests: `test/example.test.ts` verifies that `createExampleApp({ secret: <32+ chars>, adminPassword: "x" })` resolves (schema, seed and all registrations succeed) and `app.request("/")` returns 302 with `Location: /admin/`.
- [ ] History records whether the manual `pnpm example` + `GET /` → 302 check was run, and its outcome.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "example", section "Phase gates")
- Decisions: docs/orchestraude/decisions/005-dependency-set.md

## History
