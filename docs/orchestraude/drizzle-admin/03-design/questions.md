# Questions

## Open questions
(The designer could not decide these. The orchestrator relays them to the user.)
Changed 2026-10-07: Q5 added (proposal from the review revision), then answered and moved to Resolved questions.

(None.)

## Resolved questions
(Question, answer, date. Move items here once the user has decided.)
- **Q5. Date widget for PG `date()` string-mode columns.** Answer: yes (option (a)). `date()` fields get `isDateOnly`, the `date` widget (`<input type="date">`) and the date-preset filters; values stay `YYYY-MM-DD` strings end to end with no Date conversion. Coercion validates the strict `YYYY-MM-DD` format and keeps the string; filter bounds are `toDateOnly` strings of `calendarPresetRange`, so the time zone only decides "today" (consistent with decision 019). List display stays as stored (`2026-10-07`) (2026-10-07; decision 023; introspect.md, forms.md, data.md, views.md, support.md, admin.md, routes-handlers.md, test-strategy.md).
- **hono/csrf fixed-origin comparison (review revision).** Answer: whether `csrf({ origin: publicOrigin })` compares by exact equality stays unverified at design time. The implementation task must prove it with tests: a non-matching Origin, such as a different port or a trailing slash, is rejected with 403. If the behaviour differs, the implementer reports blocked (2026-10-07; decision 020; auth.md, test-strategy.md).
- pnpm provisioning: pnpm is provisioned via mise.toml with a pinned version. The user pinned `pnpm = "12.10.0"` themselves, so no implementation task edits mise.toml (2026-10-07; decision 001).
- **Q1. CSRF token in external-auth (`getUser`) mode.** Answer: use the same signed `da_session` cookie with `u: null`, holding only `csrf` and `iat`; `getUser(req)` stays the only source of the user. The stateless `HMAC(secret, user.id)` alternative was not chosen (2026-10-07; decision 014; auth.md, routes.md).
- **Q2. `HookCtx` definition.** Answer: `{ mode: "add" | "change" | "delete"; user: AdminUser; db: unknown }`, `"delete"` only for `beforeDelete`. It matches the action ctx shape `{ ids, db, user }`; `request` is not exposed (it would couple hooks to HTTP details and can be added later compatibly) (2026-10-07; decision 015; admin.md, routes-handlers.md).
- **Q3. Permission required to run custom actions.** Answer: `change`. The built-in delete action still requires `delete` (2026-10-07; decision 016; auth.md, routes-handlers.md).
- **Q4. Reverse-proxy support.** Answer: add `AdminConfig.publicOrigin?: string` in v1 (not documentation-only). It is used for the Origin check and for the cookie `Secure` flag. This is a public API addition over §5, recorded with its reason: most production deployments sit behind a proxy, so without it the library is practically unusable as OSS (2026-10-07; decision 017; admin.md, auth.md, routes.md, project-setup.md README outline, test-strategy.md).
