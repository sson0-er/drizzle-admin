---
id: 43-instance-bound-cookie-keys
depends_on: [42-register-check-order]
status: pending
attempts: 0
---
# Task 43: instance-bound-cookie-keys

## Goal
Security audit fixes, part 1 (session and config):
- `da_session` and `da_flash` are signed with keys derived per instance and per cookie from `secret`, the cookie name and the prefix (decision 042). Two instances with the same `secret` but different basePaths reject each other's cookies, a `da_session` value is never a valid `da_flash`, and replicas (same `secret`, same basePath) still share sessions. The raw `secret` reaches no cookie function.
- `createAdmin` rejects `sessionMaxAgeSec` above 34560000 (400 days), so hono's cookie serializer can no longer make every page a 500 (decision 042 point 6).
- In external mode the login redirect passes `next` through `safeNext`, so `GET //evil.com/` with basePath `"/"` sends `next=%2F` to `loginUrl` (decision 047).

Source findings: docs/orchestraude/drizzle-admin/security-audit/verify.md (finding B) and docs/orchestraude/drizzle-admin/security-audit/auth.findings.json.

## Scope
### Files to touch
- src/auth/session.ts (`deriveCookieKey`; `CookieOpts.key` replaces `secret`; `readSession` / `writeSession` pass `o.key`)
- src/auth/flash.ts (`FlashOpts.key` replaces `secret`)
- src/routes/context.ts (`AdminVars.cookieKeys`; `cookieOpts(c)` / `flashOpts(c)` take the context; `renderPage` / `redirectWithFlash` call `flashOpts(c)`)
- src/routes/middleware.ts (only `sessionMiddleware` and the external-mode branch of `authGuard`)
- src/routes/index.ts (only the memoized `getCookieKeys` closure and the `sessionMiddleware(state, getCookieKeys)` call)
- src/routes/login.ts (only the two `cookieOpts(...)` calls become `cookieOpts(c)`)
- src/admin.ts (only the `sessionMaxAgeSec` check in `createAdmin`)
- test/session.test.ts, test/flash.test.ts, test/auth.test.ts, test/config.test.ts

### Do not touch
- `securityHeaders`, `initVars`, `userMiddleware`, `csrfToken` and the builtin-mode branch of `authGuard` in src/routes/middleware.ts (CSP is task 47)
- `modelOr404` in src/routes/context.ts (task 44)
- src/auth/redirect.ts (`safeNext` and `externalLoginUrl` stay unchanged, decision 047 point 2), src/auth/csrf.ts, src/auth/permissions.ts
- `register` and `ResolvedModel` building in src/admin.ts (tasks 44, 46); src/types.ts (`AdminConfig.secret` stays a string)
- Every other file under src/**, example/**, test/helpers/**, test/fixtures/**, every other test file
- README.md, CHANGELOG.md, CLAUDE.md (task 48), package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Do not change the session payload shape (`u`, `csrf`, `iat` only) or any cookie attribute.
- Do not delete, weaken or skip an existing assertion, except where Implementation notes say how a hand-signed cookie is now built.
- Do not commit.

## Implementation notes
Follow the conventions in CLAUDE.md: one case per `it.each` row, exact message and status assertions.

- **`deriveCookieKey`** (auth.md `session.ts`, the bullet starting "`deriveCookieKey` uses Web Crypto only"): `crypto.subtle.importKey("raw", UTF-8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])`, then `crypto.subtle.sign("HMAC", key, UTF-8(cookieName + "\0" + prefix))`. Returns the 32-byte `ArrayBuffer`. No `node:` import (Biome `noNodejsModules`, and `pnpm build` uses `types: []`).
- **Cookie options**: `CookieOpts = { key: ArrayBuffer; prefix; maxAgeSec; publicOrigin }`, `FlashOpts = { key: ArrayBuffer; prefix; publicOrigin }`. The key goes to `getSignedCookie` / `setSignedCookie` unchanged (they accept a `BufferSource`; evidence 2026-10-08-hono-signed-cookie-key-and-max-age). `cookieAttrs` is unchanged.
- **Lazy derivation** (routes.md "Cookie keys", the paragraph after the API block, and Middleware order step 4):
  - In `buildApp`: `let keys: Promise<{ session: ArrayBuffer; flash: ArrayBuffer }> | undefined;` and `const getCookieKeys = () => (keys ??= Promise.all([deriveCookieKey(config.secret, SESSION_COOKIE, config.prefix), deriveCookieKey(config.secret, FLASH_COOKIE, config.prefix)]).then(([session, flash]) => ({ session, flash })));`. Do not start the promise at build time.
  - `sessionMiddleware(state, getCookieKeys)` first does `c.set("cookieKeys", await getCookieKeys())`, then reads the session with `cookieOpts(c)`. The rest of the middleware is unchanged.
  - `cookieOpts(c)` = `{ key: c.var.cookieKeys.session, prefix, maxAgeSec: sessionMaxAgeSec, publicOrigin }`; `flashOpts(c)` = `{ key: c.var.cookieKeys.flash, prefix, publicOrigin }`. Both read `state` from `c.var.state`.
- **`sessionMaxAgeSec`** (admin.md `createAdmin` table): if given, it must be an integer with `0 < v <= 34560000`; every failure throws `drizzle-admin: sessionMaxAgeSec must be a positive integer of at most 34560000 (400 days)`. The default stays `28800`.
- **External `next`** (routes.md Middleware order step 6, external with `loginUrl`): `c.redirect(externalLoginUrl(auth.loginUrl, safeNext(target, prefix)), 302)`. `target` is still the raw `pathname + search` (decision 032). Every method, as before. Import `safeNext` from `../auth/redirect.js`.
- **Tests** (test-strategy.md "Security audit fixes", the "Cookie keys", "Cross-instance", `config.test.ts` and "External `next`" bullets):
  - test/session.test.ts: `deriveCookieKey` returns 32 bytes and equal bytes for equal inputs; the keys differ for `da_session` vs `da_flash` and for prefixes `"/a"`, `"/b"` and `""` (it.each rows). A session written with `key` reads back. A cookie signed with the raw `secret` string (the pre-042 format) reads as `null`. The shared `opts` gets `key: await deriveCookieKey("s3cret", SESSION_COOKIE, "/admin")` (top-level await or `beforeAll`). The `/raw` route signs with `o.key` by default; the existing foreign-secret case signs with a key derived from another secret.
  - test/flash.test.ts: `opts` uses the derived flash key. A `da_session` value (written by `writeSession` with the session key of the same secret and prefix) sent as the `da_flash` cookie gives `consumeFlash` → `[]`. The existing "other secret" case derives its key from the other secret.
  - test/auth.test.ts:
    - The `signedCookie` helper signs with `await deriveCookieKey(secret, "da_session", "/admin")` (`serializeSigned` accepts a `BufferSource`). The existing cases "treats a tampered cookie as logged out", "treats a cookie signed with another secret as logged out" and "accepts a hand-signed cookie with the right secret, and rejects an expired one" keep their assertions.
    - New describe "cross-instance sessions (decision 042)", SQLite fixture (`dialects[0]`) is enough. Two builtin `createAdmin` instances over the same `fixture.setup()` DB, the same `TEST_SECRET`, both registering `authors`: basePath `/a` (accepts `alice` / `TEST_PASSWORD`) and `/b` (accepts only `bob`), mounted in one outer `new Hono()` (`outer.route("/a", a.app); outer.route("/b", b.app)`) and reached with `createClient(outer.fetch)`. After `login({ prefix: "/a", username: "alice" })` (303), `GET /b/` → 302 with `Location: /b/login/?next=%2Fb%2F`. Flash: after a successful `authors` add at `/a` (303, sets `da_flash`), the next request is `GET /b/login/` (a 200 page that consumes flash and is reachable while logged out at `/b`) → 200 with no `ul.messagelist`. Before the change the `/a` message shows there, because both instances verify with the same secret. Use a fresh client for this case so no earlier page consumes the flash. Replicas: two instances with the same secret and basePath `/a`; a session from a login on one → `GET /a/` on the other with that `da_session` cookie → 200.
    - External `next`: `makeAdmin(fixture, { config: { basePath: "/", auth: { getUser: async () => null, loginUrl: "/sso/login" } } })` → `GET //evil.com/` → 302, `Location: /sso/login?next=%2F` (exact). With basePath `/admin` and the same auth, `GET /admin/authors/?q=1` → `Location: /sso/login?next=%2Fadmin%2Fauthors%2F%3Fq%3D1` (exact). Put them next to the existing external-auth tests.
  - test/config.test.ts: `sessionMaxAgeSec: 34560000` is accepted (resolved value `34560000`); `34560001`, `0` and `1.5` each throw exactly `drizzle-admin: sessionMaxAgeSec must be a positive integer of at most 34560000 (400 days)` (it.each). Existing `sessionMaxAgeSec` cases that match a shorter message keep passing or are switched to the exact new message.
- Write the cross-instance test, the external `//evil.com/` test and the `34560001` case first and run them against the unchanged code. They must fail there (200 instead of 302; `next=%2F%2Fevil.com%2F`; no throw). Record the received values in History.
- No export or prop beyond the design is expected. If one is added, record it in History.

## Definition of Done
- [ ] src/auth/session.ts exports `deriveCookieKey(secret: string, cookieName: string, prefix: string): Promise<ArrayBuffer>`. `CookieOpts` and `FlashOpts` have a `key: ArrayBuffer` member and no `secret` member.
- [ ] `grep -n "secret" src/auth/session.ts src/auth/flash.ts src/routes/context.ts src/routes/middleware.ts src/routes/login.ts` matches, outside comments, only the `deriveCookieKey` parameter and its uses inside that function. In src/routes/index.ts, `config.secret` appears only inside `getCookieKeys`.
- [ ] `sessionMiddleware` takes `(state, getCookieKeys)` and sets `c.var.cookieKeys` before `readSession`. `AdminVars` has `cookieKeys: { session: ArrayBuffer; flash: ArrayBuffer }`.
- [ ] Tests (test/session.test.ts): the `deriveCookieKey` cases (32 bytes, deterministic, distinct per cookie name and per prefix `"/a"`, `"/b"`, `""`), the round trip with `key`, and the raw-secret cookie → `null` all pass.
- [ ] Tests (test/flash.test.ts): a `da_session` value sent as `da_flash` → `consumeFlash` returns `[]`.
- [ ] Tests (test/auth.test.ts): `/a` session sent to `/b/` → 302 `Location: /b/login/?next=%2Fb%2F`; the `/a` flash shows no `ul.messagelist` on `GET /b/login/`; replica instance → 200; external `GET //evil.com/` with basePath `"/"` → `Location: /sso/login?next=%2F`; external `/admin/authors/?q=1` → `next=%2Fadmin%2Fauthors%2F%3Fq%3D1`. The three existing hand-signed-cookie tests pass with the derived key.
- [ ] Tests (test/config.test.ts): `34560000` accepted; `34560001`, `0`, `1.5` each throw the exact message.
- [ ] History records that the cross-instance, external `//evil.com/` and `34560001` tests failed against the pre-change code, with the received values.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md (`session.ts`, `flash.ts`, `redirect.ts`, "Data formats")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md (API block, "Cookie keys" paragraph, "Middleware order" steps 4 and 6)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md#`createAdmin(config: AdminConfig): Admin`
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md ("Security audit fixes (decisions 042-048)"; §10 matrix rows "Signed cookie" and "External auth")
- Decisions: docs/orchestraude/decisions/042-instance-bound-cookie-keys.md, docs/orchestraude/decisions/047-external-login-next-safenext.md, docs/orchestraude/decisions/032-safenext-decoded-path-rules.md
- Evidence: docs/orchestraude/evidence/2026-10-08-hono-signed-cookie-key-and-max-age.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
