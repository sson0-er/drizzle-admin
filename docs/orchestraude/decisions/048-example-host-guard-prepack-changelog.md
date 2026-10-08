# 048: The example server rejects unexpected Host headers; `prepack` builds `dist`; a changelog records the audit changes

- Date: 2026-10-08
- Status: accepted

## Context
Two low audit findings outside the library code, plus a changelog the user asked for:
- views.findings: the demo binds to `127.0.0.1` (decision 038) but accepts any Host header, and its default password `admin` is public. A DNS-rebinding page can then log in and use the demo as same-origin (example/server.ts).
- views.findings: `files` publishes `dist`, which is gitignored and built by hand, so `npm publish` can ship a stale build (package.json).
- Decision 042 signs everyone out once; the user asked for a changelog note. The repository has no changelog yet.
User decision (2026-10-08): reject requests whose Host is not the bound host:port with an allowlist derived from `HOST` / `PORT`; add `prepublishOnly` or `prepack` running the build; note the sign-out in the changelog.

## Decision
1. Host guard. New module `example/host-guard.ts`:
   - `isAllowedHost(requestUrl: string, bindHost: string, port: number): boolean`. Let `u = new URL(requestUrl)`, `h = u.hostname` (lowercase; IPv6 in brackets), effective port `u.port === "" ? (https: 443, else 80) : Number(u.port)`, and `b` = `bindHost` lowercased, in brackets when it contains `:`. Loopback names: `localhost`, `127.0.0.1`, `[::1]`. Wildcards: `0.0.0.0`, `[::]`. Allowed when the effective port equals `port` and one of: `h === b`; `b` is a loopback name or a wildcard and `h` is a loopback name; `b` is a wildcard and `h` is an IP literal (dotted IPv4 `/^\d{1,3}(\.\d{1,3}){3}$/` or a bracketed IPv6).
   - `hostGuard(bindHost: string, port: number): MiddlewareHandler`: when `isAllowedHost(c.req.url, ...)` is false, answers `403` with the plain-text body `Forbidden: unexpected Host header` (example code; not a library UI string).
   - `example/server.ts` serves a new root app: `const root = new Hono(); root.use("*", hostGuard(hostname, port)); root.route("/", app);` and passes `root.fetch` to `serve`. `createExampleApp` is unchanged, so the smoke tests keep working.
2. Packaging. `package.json` gets `"prepack": "pnpm build"`.
3. Changelog. New `CHANGELOG.md` at the repository root, added to `files`. It starts with an `## Unreleased` section that lists the user-visible changes of decisions 042-047: everyone is signed out once after the upgrade (042); `sessionMaxAgeSec` above 400 days is rejected (042); unset `add` / `change` / `delete` follow `view`, and models without any permission answer 404 (043); new CSP and `nosniff` headers (044); input bounds: search text capped at 200 characters, at most 500 selected rows per action, `listPerPage` capped at 500, stricter integer input (045); `exclude` shapes the default list columns and identity columns are read-only (046); external-mode `next` is sanitized (047).

## Alternatives considered
- Allow only the exact `HOST:PORT`: `localhost:3000` would fail when the demo binds to `127.0.0.1`, and a wildcard bind (`HOST=0.0.0.0`) could not be reached by LAN IP at all.
- For wildcard binds, skip the check: leaves the rebinding attack open on the configuration that exposes the demo most. An IP-literal Host cannot result from DNS rebinding, because rebinding needs an attacker-controlled host name, so accepting IP literals keeps LAN access without reopening the attack (reasoning, no external source).
- Put the guard into `createExampleApp`: the in-process smoke tests use `http://localhost/` (port 80) and would need to pass bind options; the guard belongs to the listening server.
- `prepublishOnly`: runs only on `npm publish`; `prepack` also runs for `npm pack` and git-dependency installs, so every tarball is built from source (evidence: 2026-10-08-prepack-lifecycle). Whether `pnpm pack` runs `prepack` is not confirmed by the pnpm docs (evidence: 2026-10-08-prepack-lifecycle).
- A "Changelog" section in README instead of a file: the README describes the current behavior; release notes are a separate concern and the conventional `CHANGELOG.md` is easy to find.

## Rationale
`@hono/node-server` builds the request URL from the Host header (evidence: 2026-10-08-hono-head-cookie-body-node-server), so `c.req.url` carries the Host the browser sent. npm runs `prepack` before every pack or publish (evidence: 2026-10-08-prepack-lifecycle), and pnpm's publish lifecycle includes it.

## Consequences
- example.md (`host-guard.ts`, server wiring), project-setup.md (`prepack`, `CHANGELOG.md`, `files`, README section 11), test-strategy.md (example row).
