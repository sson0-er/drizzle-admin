---
id: 13-auth-origin-check
depends_on: [01-project-setup]
status: done
attempts: 0
---
# Task 13: auth-origin-check

## Goal
`originCheck(publicOrigin)` wraps `hono/csrf` so that unsafe form posts pass only when `Sec-Fetch-Site: same-origin` or the Origin equals the expected origin exactly (the request URL origin, or `publicOrigin` when configured). `tokensEqual` compares CSRF tokens in constant time. Exact-match behavior is proven by tests (decision 020).

## Scope
### Files to touch
- src/auth/csrf.ts
- test/csrf.test.ts
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/auth/session.ts, src/auth/flash.ts, src/auth/permissions.ts, src/routes/**
- package.json (do not change the hono version)

## Implementation notes
- API: `interfaces/auth.md#csrfts`. `CSRF_FIELD = "_csrf"`. `publicOrigin === null` → `csrf()`; otherwise `csrf({ origin: publicOrigin })`. Keep `secFetchSite` at its default.
- `tokensEqual(a, b)`: false when lengths differ; otherwise XOR-accumulate all char codes over the full length, no early exit.
- Tests use a minimal Hono app: `app.use("*", originCheck(x)); app.post("/", c => c.text("ok"))`, and `app.request("http://internal:3000/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: ... }, body: "a=1" })`. hono/csrf only checks form content types, so always send one. Do not send `Sec-Fetch-Site` unless the case requires it. The rejected status is 403 (hono throws an `HTTPException`; the default handler turns it into 403).
- Decision 020 (user decision): with `publicOrigin = "https://admin.example.com"`, each of the four non-matching Origins below must get 403 and the exact Origin must pass. **If any case behaves differently with the pinned hono, stop and report the task as blocked.** Do not work around it (for example with a function-valued `origin`) without a new decision.

## Definition of Done
- [ ] Tests: `test/csrf.test.ts`, with `originCheck("https://admin.example.com")` and request URL `http://internal:3000/`, verifies a form POST without `Sec-Fetch-Site` returns 200 with `Origin: https://admin.example.com`, and returns 403 for each of `Origin: https://admin.example.com:8443` (different port), `Origin: https://admin.example.com/` (trailing slash), `Origin: https://admin.example.com.evil.example` (longer host with the same prefix) and `Origin: http://admin.example.com` (different scheme). All five cases are present and none is skipped.
- [ ] Tests: `test/csrf.test.ts` verifies that with `publicOrigin` set, `Origin: http://internal:3000` (the request URL origin) and no `Sec-Fetch-Site` → 403, and `Sec-Fetch-Site: same-origin` without Origin → 200.
- [ ] Tests: `test/csrf.test.ts` verifies `originCheck(null)`: Origin equal to the request URL origin → 200; `Origin: http://evil.example` → 403; no Origin and no `Sec-Fetch-Site` → 403; a GET passes without Origin.
- [ ] Tests: `test/csrf.test.ts` verifies `tokensEqual`: equal → true, different same-length → false, different length → false, empty vs non-empty → false.
- [ ] If any decision-020 case does not match, the task status is set to blocked and History states the observed status per Origin; `originCheck` is not changed.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/auth.md#csrfts
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (row "auth", §10 rows "Origin check" and "Reverse proxy")
- Decisions: docs/orchestraude/decisions/020-hono-csrf-origin-equality-by-test.md, 017-public-origin.md, 008-session-csrf-flash.md
- Evidence: 2026-10-07-hono-csrf-origin-option, 2026-10-07-hono-csrf-and-jsx

## History
