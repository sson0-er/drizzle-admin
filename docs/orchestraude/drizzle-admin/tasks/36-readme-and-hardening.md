---
id: 36-readme-and-hardening
depends_on: [27-fk-ordering-and-example, 28-fk-reference-view-permission, 32-password-no-echo, 34-test-gaps-data-time]
status: done
attempts: 0
---
# Task 36: readme-and-hardening

## Goal
The README describes the security model and behavior as they are now:
- logout does not revoke the session cookie;
- the Origin check covers only form-like unsafe requests;
- the quick start warns about plain password comparison;
- external-mode `/login/` and `/logout/` answer as they really do;
- custom action `ids` are untrusted;
- the reverse-proxy section asks for a request body size limit;
- the example binds to `127.0.0.1`;
- the password widget and FK view-permission behaviors of tasks 28-32 are described.

In code:
- `describeForLog` writes only safe-charset names and codes;
- the `safeNext` doc comment matches the code;
- the `run` JSDoc says that `ids` is untrusted input.

Covers L049, L050, L087, L051, L082, L045, L046, L004, L080 and decision 038 item 1.

## Scope
### Files to touch
- README.md
- test/readme.test.ts
- src/data/errors.ts
- test/errors.test.ts
- src/auth/redirect.ts (doc comment only)
- src/types.ts (JSDoc of `AdminAction.run` only)
### Do not touch
- Code behavior in src/auth/redirect.ts and src/types.ts (comment-only changes there)
- src/** other than the three files above
- The 12 `##` README section titles and their order (`readme.test.ts` pins them)
- docs/** (except this task's History), CLAUDE.md, example/**, mise.toml, package.json
- Do not commit.

## Implementation notes
- README (project-setup.md "README.md outline" lists what sections 8-11 must say). Edits by section:
  - Quick start (L051): next to `password === process.env.ADMIN_PASSWORD`, add a code comment. It says real deployments should verify a stored hash (bcrypt, argon2 or scrypt) or compare in constant time, and that the login has no rate limiting.
  - Model options → Widgets (decision 037): replace the sentence "The `password` widget is an `<input type="password">` that is filled with the current value..." with the decision 037 behavior:
    - the input always renders empty;
    - leaving it empty on the change page keeps the stored value, so a nullable password field cannot be cleared through the form;
    - read-only fields and list cells show `********`;
    - it adds no hashing.
  - Actions (L045): state that `ids` are the raw `_selected` strings from the client. They are untrusted: they may name rows that do not exist, may not parse as keys, and may be any number. `run` must parse and validate them and scope its queries itself.
  - Authentication modes (L049, L082):
    - built-in logout "deletes the session cookie in the browser"; do not say it clears or revokes the session;
    - external mode has no login or logout route of its own: for a logged-in user `/login/` and `/logout/` return 404, and an anonymous request is redirected to `loginUrl` (or gets 401 without it) like any other page.
  - CSRF and headers (L050, L087): the Origin check applies to unsafe-method requests with a form-like content type (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` or none). GET/HEAD and other content types skip it, but every POST still needs the `_csrf` token. Fix the "non-browser clients ... get 403" sentence in the reverse-proxy subsection the same way.
  - Permissions (decision 034): without `view` on a referenced model, FK columns show raw values without links or labels, the FK filter is not offered, and FK form fields are plain key inputs.
  - Deploying behind a reverse proxy (decision 038): limit the request body size at the proxy or in the host app, because the admin reads each form body fully into memory and has no limit of its own.
  - Behavior notes:
    - the Filters bullet says FK choices come in the referenced model's `ordering`, or primary key descending when unset (task 27);
    - add the password widget and FK view-permission notes (outline section 9).
  - Known limitations:
    - L049: logout does not revoke the stateless session. A copied `da_session` cookie stays valid until `sessionMaxAgeSec` passes. Changing `secret` invalidates all sessions;
    - decision 038: no request body size limit inside the library.
  - Development (decision 038): the example listens on `127.0.0.1:3000` unless `HOST` / `PORT` are set. URLs read `http://127.0.0.1:3000/admin/`. Add `HOST=0.0.0.0 pnpm example   # listen on all interfaces (set ADMIN_PASSWORD first)` (example.md "Data formats"). Verify that the printed URL matches `example/server.ts` as left by task 27.
  - Describe only behavior that exists in src. Check each new statement against the code.
- `test/readme.test.ts`: the run-instructions test expects `http://127.0.0.1:3000/admin/` and `HOST=0.0.0.0` instead of `http://localhost:3000/admin/`. Add one test: the "Known limitations" section mentions both the session revocation limit (`/revoke/i`) and the body size limit (`/body size/i`).
- `src/data/errors.ts` (L046): before building the log line, `name` and `code` must each match `/^[A-Za-z0-9_.-]{1,64}$/`, otherwise they are written as `-`. A missing or empty name stays `unknown` (data.md, decision 033 item 16). Classification still uses the raw code, so only the output is sanitized. Note: data.md does not yet state this rule. Record it in History so the orchestrator updates the design.
- `src/auth/redirect.ts` (L004, L080): in the `safeNext` doc comment, remove the doubled "and". State that a raw `next` must not start with `//`, and that `//` anywhere in the URL-normalized path is rejected (code line 38; auth.md step 4).
- `src/types.ts` (L045): add a JSDoc on `AdminAction.run` (or on `ids`) saying that `ids` are the client-submitted `_selected` values as strings. They are not checked against the database and may be nonexistent, malformed or numerous, so `run` must validate them.
- CLAUDE.md conventions apply.

## Definition of Done
- [ ] README.md contains every edit listed above.
- [ ] README.md no longer contains `filled with the current value`, `clears the session`, `Every request passes through an Origin check`, or `http://localhost:3000`.
- [ ] Tests: `test/readme.test.ts`. The updated run-instructions test passes, and the new Known-limitations test asserts the revocation and body-size mentions.
- [ ] Tests: `test/errors.test.ts`, it.each over `describeForLog`:
  - a code containing a newline → `<kind> <name> -`;
  - a name containing a space or newline → name `-`;
  - a 65-character code → code `-`;
  - a 64-character `[A-Za-z0-9_.-]` code → written unchanged;
  - an error without a name → `unknown`.
- [ ] `src/auth/redirect.ts` contains no `and and`. The `run` member in `src/types.ts` has a JSDoc that contains the word `untrusted`.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md (section "README.md outline")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md (sections "`example/server.ts`", "Data formats")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/data.md (section "`src/data/errors.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (section "`redirect.ts`")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (section "Middleware order", steps 3 and 6)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md (section "Public types")
- Decisions: docs/orchestraude/decisions/034-fk-reference-view-permission.md, docs/orchestraude/decisions/037-password-widget-no-echo.md, docs/orchestraude/decisions/038-body-size-and-example-bind.md, docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 16)
- Findings: docs/orchestraude/drizzle-admin/05-low-findings.md (L045, L046, L049-L051, L080, L082, L087 details)
- Evidence: docs/orchestraude/evidence/2026-10-07-hono-csrf-and-jsx.md (scope of hono/csrf)

## History
- 2026-10-08 implementer: `describeForLog` (src/data/errors.ts) now writes `name` and `code` only when they match `/^[A-Za-z0-9_.-]{1,64}$/`, otherwise `-` (a missing or empty name stays `unknown`; classification still uses the raw code). data.md does not state this rule yet: the orchestrator should update the design.
- 2026-10-08 implementer: approved scope addition from the orchestrator (task 27 security review): `example/server.ts` uses `process.env.HOST || "127.0.0.1"` so an empty `HOST` falls back to loopback instead of listening on all interfaces; a why-comment was added. The README says an empty `HOST` falls back to `127.0.0.1`. example.md (`hostname = process.env.HOST ?? "127.0.0.1"`) should be updated to `||`.
- 2026-10-08 implementer: README wording check against hono/csrf: a form-like unsafe request with neither `Sec-Fetch-Site: same-origin` nor a matching `Origin` gets 403 (a missing header does not pass), so the reverse-proxy sentence says "sends neither header, or a different Origin".
- No exports or props were added.
