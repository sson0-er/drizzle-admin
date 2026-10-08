# 038: No in-library POST body limit in v1; the example server binds to 127.0.0.1

- Date: 2026-10-08
- Status: accepted

## Context
Two follow-ups outside the triage list (tasks 14 and 06): POST bodies are parsed with no size limit, and the example server listens on all interfaces with the default credentials admin/admin.

## Decision
User decision (2026-10-08).
1. Body size: v1 adds no request body limit inside the library. The README (section 8 "Deploying behind a reverse proxy" and section 10 "Known limitations") tells deployers to limit the request body size at the reverse proxy or the host app, because the admin parses the whole form body into memory.
2. Example: `example/server.ts` passes `hostname: process.env.HOST || "127.0.0.1"` to `serve()`, so the demo is reachable only from the local machine unless `HOST` is set to a non-empty value. The printed URL and the run instructions use that host.
   Changed 2026-10-08 (task 36): `||` instead of `??`, so an empty `HOST` also falls back to `127.0.0.1`. With `??`, `HOST=""` would reach `server.listen(port, "")`, which listens on all interfaces (evidence: 2026-10-08-node-listen-empty-hostname). The README states that an empty `HOST` falls back to `127.0.0.1`.

## Alternatives considered
- Apply Hono's `bodyLimit` middleware with a fixed or configurable limit: a public option or a hard-coded number the requirements do not ask for; the host app or proxy can already enforce it.
- Keep the example on all interfaces with a printed warning: the default password would be exposed on the network.
- `process.env.HOST ?? "127.0.0.1"` (the original wording): an empty `HOST` would bind to all interfaces, contradicting the loopback default (evidence: 2026-10-08-node-listen-empty-hostname).

## Rationale
Hono's `parseBody` reads the full body with `arrayBuffer()` and has no limit; Hono offers a separate `body-limit` middleware (evidence: 2026-10-08-hono-head-cookie-body-node-server). `@hono/node-server` `serve` passes `hostname` to `server.listen(port, hostname)`, and the request URL still comes from the Host header, so the Origin check is unaffected (evidence: 2026-10-08-hono-head-cookie-body-node-server). An empty hostname is treated as no hostname by Node, which listens on all interfaces; hence `||` rather than `??` (evidence: 2026-10-08-node-listen-empty-hostname).

## Consequences
- project-setup.md README outline (sections 8 and 10), example.md (`HOST`, printed URL, run instructions).
- Follow-up changes in `README.md` and `example/server.ts`.
