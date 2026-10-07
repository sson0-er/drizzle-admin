# 020: hono/csrf fixed-origin equality is proven by an implementation test

- Date: 2026-10-07
- Status: accepted (user decision)

## Context
Decision 017 configures `hono/csrf` with `origin: publicOrigin`. The docs do not say whether the string option is compared by exact equality. A looser comparison (for example a prefix match) would accept origins that differ only in port or trailing characters (evidence: 2026-10-07-hono-csrf-origin-option).

## Decision
The behaviour stays unverified at design time. The implementation task that builds `originCheck` must prove with tests that only an exact match passes. With `publicOrigin = "https://admin.example.com"`, a POST without `Sec-Fetch-Site` is rejected with 403 when its Origin is any of:
- a different port (`https://admin.example.com:8443`)
- a trailing slash (`https://admin.example.com/`)
- a longer host with the same prefix (`https://admin.example.com.evil.example`)
- a different scheme (`http://admin.example.com`)

A POST whose Origin is exactly `https://admin.example.com` passes. If the observed behaviour differs, the implementer stops and reports the task as blocked. The implementer must not work around the difference silently, for example by switching to a function-valued `origin` without a new decision.

## Alternatives considered
- Read the hono source now and record evidence: the user chose to defer this to the implementation test.
- Always pass a function `(origin) => origin === publicOrigin`: guarantees exact equality without relying on hono internals. Not chosen now; this is the likely remedy if the test fails, decided at that point.

## Rationale
The user decided this (2026-10-07). The equality check is unverified (evidence: 2026-10-07-hono-csrf-origin-option). A test against the pinned hono version proves the behaviour that actually ships.

## Consequences
- `csrf.test.ts` (auth) contains the cases above. A failing case blocks the task instead of being skipped.
