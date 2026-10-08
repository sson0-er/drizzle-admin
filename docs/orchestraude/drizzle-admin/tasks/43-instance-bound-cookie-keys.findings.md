# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [quality] Unused _state parameter on sessionMiddleware
  - location: src/routes/middleware.ts:31
  - detail: sessionMiddleware no longer reads state, so the parameter is dead and only silenced with an underscore. Drop it and update the call in src/routes/index.ts and any tests that call it, unless the design pins the signature (the History says it does; then ignore).
  - evidence: (none)
- [quality] Magic number 34560000 in config validation
  - location: src/admin.ts:77
  - detail: The 400-day limit is a bare literal repeated in the error message. A named module-private constant (e.g. MAX_SESSION_AGE_SEC) would carry the why once and keep the message in sync.
  - evidence: (none)

