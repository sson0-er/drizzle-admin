---
id: 2026-10-08-node-listen-empty-hostname
question: For decision 038 (example bind), what address does the example server listen on when HOST is set but empty?
source: node 24.21.0 runtime probe (`http.createServer().listen(0, "")`), node_modules/@hono/node-server 2.1.3 dist/index.mjs (`server.listen(options?.port ?? 3e3, options.hostname, ...)`)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `@hono/node-server` `serve` passes `hostname` unchanged to `server.listen(port, hostname)`.
- On Node 24.21.0, `listen(0, "")` reports `address()` as `{ address: "::", family: "IPv6" }`: an empty host is treated like no host, so the server listens on all interfaces.
- Therefore `process.env.HOST ?? "127.0.0.1"` with `HOST=""` would listen on all interfaces; `process.env.HOST || "127.0.0.1"` falls back to loopback.

Not confirmed:
- Whether `::` also accepts IPv4 connections depends on the OS dual-stack setting (not tested).
