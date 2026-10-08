# 032: safeNext judges both the raw and the percent-decoded path

- Date: 2026-10-08
- Status: accepted

## Context
Task 22 review found the first `safeNext` (`src/auth/redirect.ts`) both too strict and too loose, and auth.md did not say whether `next` is judged in raw or decoded form.
- Too strict: it rejected any whitespace in the percent-decoded path, so after login a legitimate text-PK page such as `/admin/kv/a%20b/change/` (kv has a text PK) fell back to the dashboard.
- Too loose: `/admin/..%2Fx` and `/admin/%2e%2e%2fx` were returned unchanged. The URL parser does not treat `..%2Fx` as a dot segment, so the raw prefix check passes, but the decoded form is `/admin/../x` (evidence: 2026-10-08-safenext-decoded-path). The origin cannot change, so it is not an open redirect. A proxy or router that decodes and then normalizes could still resolve it outside the prefix.

## Decision
User decision (2026-10-08). `safeNext(next, prefix)` keeps the checks auth.md already listed and adds four more:
- (a) the percent-decoded path contains no control character (U+0000-U+001F, U+007F) and no `\`;
- (b) the raw path (`url.pathname`, before decoding) contains no `//`;
- (c) a malformed percent escape (`decodeURIComponent` throws) is rejected;
- (d) the percent-decoded path has no `.` or `..` segment (split on `/`), so the decoded target cannot leave the prefix.

Changed 2026-10-08 (user answer): (d) applies after URL normalization. A literal `.`/`..` segment (and a segment that is exactly `%2e` or `%2e%2e`) is resolved by `new URL` first. The normalized path is accepted if it stays under the prefix (`/admin/./x` → `/admin/x`, `/admin/a/../b/` → `/admin/b/`, `/admin/%2e/x` → `/admin/x`; evidence: 2026-10-08-safenext-decoded-path) and rejected by the prefix check otherwise (`/admin/../x`). Only percent-encoded dot segments that survive normalization because an encoded slash joins them to a neighbour, and that read `.`/`..` after decoding, are rejected by (d): `/admin/..%2Fx`, `/admin/%2e%2e%2fx`, `/admin/.%2Fx`, `/admin/a%2F..%2Fb/`.

Explicitly allowed: whitespace in the decoded path (e.g. `%20` → `/admin/kv/a%20b/change/`) and an encoded `%2F` or `%2F%2F` in the raw path. This is consistent with decision 029, which notes that encoded `%2F%2F` keeps working (it stays encoded in the `Location`). Literal whitespace in the raw `next` stays rejected (existing rule). The returned value is still the raw, normalized `url.pathname + url.search`, never the decoded form.

Consequence for the auth guard (routes.md): the `path` it passes to `loginRedirectUrl` / `externalLoginUrl` is the raw percent-encoded pathname (`new URL(c.req.url).pathname`), not `c.req.path`. Hono's `c.req.path` decodes `%20` to a literal space (evidence: 2026-10-08-safenext-decoded-path), which the raw-whitespace rule would reject, so the PK-with-space page would not round-trip. This only pins down the meaning of `path + search`, which routes.md left open.

## Alternatives considered
- Keep the stricter first implementation (decoded whitespace and decoded `//` rejected): legitimate text-PK pages with spaces or encoded slashes lose their `next`; rejected by the user.
- Check only the listed raw conditions (drop all decoded checks): `/admin/..%2Fx` passes; rejected by the user.
- Normalize the decoded path and require it still to start with `${prefix}/` (review suggestion): needs our own dot-segment resolver over a decoded string; rejecting `.`/`..` segments is simpler and costs nothing real, since primary keys `.` and `..` already cannot be addressed by URL (the URL parser resolves them).
- Return the decoded path: would put literal spaces or `/` into the `Location` and change the target; rejected.

## Rationale
User decision after the task 22 review. The URL parser resolves literal and `%2e` dot segments but not segments joined by `%2F`, and `decodeURIComponent` turns them into real `..` segments (evidence: 2026-10-08-safenext-decoded-path); rule (d) closes that. Control characters and `\` in the decoded path are refused for the same reason as in decision 029: browsers drop tab/LF/CR and read `\` as `/` (evidence: 2026-10-08-trailing-slash-control-char-bypass). Whitespace is harmless in the `Location` because the returned value keeps it percent-encoded (evidence: 2026-10-08-safenext-decoded-path). How each proxy normalizes decoded `..` is unverified; rule (d) is defensive.

## Consequences
- auth.md `redirect.ts` lists the full ordered check sequence; routes.md authGuard states that `path` is the raw pathname.
- test-strategy.md `safeNext` cases updated: accept `/admin/kv/a%20b/change/`, `/admin/a%2Fb/`, `/admin/a%2F%2Fb/`, a query with `//`; accept in normalized form `/admin/./x`, `/admin/a/../b/`, `/admin/%2e/x`; reject `/admin/..%2Fx`, `/admin/%2e%2e%2fx`, `/admin/.%2Fx`, `/admin/a%2F..%2Fb`, `/admin//x`, `/admin/a%5Cb`, `/admin/a%09b`, `/admin/a%00b`, `/admin/%E0%A4%A`, literal space.
- Every `Location` from `safeNext` still satisfies the invariant of decision 029 (single-slash path under the prefix, no `\`, no control character).
- Primary keys `.` and `..` cannot be a login target (already unreachable by URL).
