# 017: AdminConfig.publicOrigin for deployments behind a reverse proxy

- Date: 2026-10-07
- Status: accepted (user answer to design question Q4)

## Context
Behind a TLS-terminating reverse proxy, the request URL seen by the app may be `http://internal-host:port`. `hono/csrf` by default compares the Origin header with the request URL origin, so form POSTs without `Sec-Fetch-Site: same-origin` get 403, and the cookie `Secure` flag, derived from the request URL scheme (decision 008), is not set. This is a public API addition over §5 (`AdminConfig` gains a field).

## Decision
Add `AdminConfig.publicOrigin?: string` in v1, for example `"https://admin.example.com"`.
- Validated by `createAdmin`: must parse with `new URL`, protocol `http:` or `https:`, no username/password, path empty or `/`, no query, no fragment. Stored normalized as `new URL(v).origin`.
- Origin check: when set, `hono/csrf` runs with `origin: publicOrigin` instead of the request URL origin; the default `Sec-Fetch-Site: same-origin` path stays (evidence: 2026-10-07-hono-csrf-origin-option).
- Cookie `Secure` flag (session and flash): when set, `Secure` iff `publicOrigin` starts with `https:`; otherwise as before (request URL scheme).
- Nothing else changes: all redirects use path-only `Location` values, so they need no origin.

## Alternatives considered
- Documentation only (the user rewrites the request URL before `admin.fetch`): rejected by the user; most production deployments sit behind a proxy, so the library would be practically unusable as OSS without extra glue.
- Trust `X-Forwarded-Proto` / `X-Forwarded-Host`: works without config, but the headers are client-spoofable when the app is reachable without the proxy, so a trusted-proxy setting would be needed anyway. More surface than one static option.
- Accept both the request URL origin and `publicOrigin`: more permissive than needed; a single configured origin is simpler to reason about.

## Rationale
`hono/csrf` supports a fixed `origin` option, combined with the Sec-Fetch-Site check by OR (evidence: 2026-10-07-hono-csrf-origin-option), so the change is a configuration of the existing middleware plus one boolean derivation. The default-origin problem behind proxies is confirmed by source reading (evidence: 2026-10-07-hono-csrf-and-jsx). Decided by the user (2026-10-07), recorded here as a public API deviation from §5 as the requirements demand.

## Consequences
- `AdminConfig` has one field more than §5.2; README configuration reference and a "Deploying behind a reverse proxy" section document it. The reverse-proxy item is removed from "Known limitations".
- When `publicOrigin` is set, direct POSTs to the internal URL pass only with `Sec-Fetch-Site: same-origin` (browsers send it; non-browser clients get 403). Intended.
- Changed 2026-10-08: the same `Secure` rule also applies when a cookie is deleted (`clearSession`, `consumeFlash`), decision 036.
