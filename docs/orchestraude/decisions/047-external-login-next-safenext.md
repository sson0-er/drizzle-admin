# 047: The external-mode login redirect passes `next` through `safeNext`

- Date: 2026-10-08
- Status: accepted

## Context
Audit (auth.findings, low): in external mode the auth guard appends the raw request path to `auth.loginUrl` as `next`. With `basePath: "/"`, `GET //evil.com/` reaches the guard and produces `next=%2F%2Fevil.com%2F`. A host login page that checks `next` with a plain `startsWith("/")` then redirects to `//evil.com/`, an open redirect starting from a link on the admin's domain (src/routes/middleware.ts:80). The built-in login already applies `safeNext` when it follows `next`, but in external mode the host's page receives the raw value. User decision (2026-10-08): never pass an unsafe `next` to `loginUrl`; the designer decides between dropping `next` and using `safeNext`.

## Decision
1. In external mode with `loginUrl`, the auth guard redirects to `externalLoginUrl(loginUrl, safeNext(target, prefix))`, where `target` is the raw `pathname + search` as today (decision 032). An unsafe target becomes `${prefix}/` (the dashboard); a safe one is passed unchanged. This applies to every method, as today.
2. `externalLoginUrl` and `safeNext` themselves are unchanged. The builtin-mode redirect is unchanged (its login handler already applies `safeNext`).
3. README "Authentication modes": the host's login page must still validate `next` before redirecting to it; the admin only sends paths under `basePath` that pass the `next` rules.

## Alternatives considered
- Drop `next` when the target is unsafe: the host then lands on its own default page instead of the admin dashboard; `safeNext` gives a predictable, safe value with the same rules as the built-in login.
- Validate only the leading `//`: a second, weaker rule next to `safeNext`; the audit's own fix suggests the same normalization as `safeNext`.

## Rationale
`safeNext` already guarantees a single-slash path under the prefix with no `\`, control character or `//` (decision 032), which is exactly the property the host's login page needs. Reusing it keeps one rule for both modes.

## Consequences
- routes.md (authGuard step 6), auth.md (callers of `externalLoginUrl`), project-setup.md (README note), test-strategy.md (external-auth row).
