# 044: Every admin response carries a Content-Security-Policy and `X-Content-Type-Options: nosniff`; the inline script is allowed by its hash

- Date: 2026-10-08
- Status: accepted

## Context
Security audit (views.findings, low; dynamic.md item 7): `securityHeaders` sets `X-Frame-Options`, `Referrer-Policy` and `Cache-Control` but no CSP and no `X-Content-Type-Options`. All output is escaped by JSX, so this is defense in depth. The list page contains one inline `<script>` (`SELECT_ALL_SCRIPT`, decision 007). User decision (2026-10-08): add both headers to every admin response and choose the directives, the inline-script treatment, and the handling of the external-mode login host and the stylesheet route.

## Decision
1. `securityHeaders` additionally sets, on every response that passes through it (pages, redirects, error pages including `onError`, the stylesheet):
   - `X-Content-Type-Options: nosniff`
   - `Content-Security-Policy`, builtin mode: `default-src 'none'; script-src 'sha256-<H>'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`
   - `Content-Security-Policy`, external mode: the same without the `form-action` directive: `default-src 'none'; script-src 'sha256-<H>'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'` (`form-action` does not fall back to `default-src`, so form submissions are unrestricted there).
   `<H>` is `SELECT_ALL_SCRIPT_SHA256`, the base64 SHA-256 of the UTF-8 bytes of `SELECT_ALL_SCRIPT` (currently `v/peDHOfIZWrfvqqPHbyzhkt2GMZ+0UvE0ARRSfmSAU=`).
   Changed 2026-10-08 (design review, security-audit fix round): the first version added the origin of an absolute external `loginUrl` to `form-action`; it is replaced by omitting `form-action` in external mode. Nothing parses `auth.loginUrl` any more (the auth guard only appends `next` to it as a string), so `createAdmin` gains no `loginUrl` validation.
2. Both headers are set unconditionally (like `X-Frame-Options`), not only when absent. The policy string depends only on `authMode`; it is built once per `buildApp` and passed to `securityHeaders` (now a factory).
3. Inline script: kept inline and allowed by hash. `SELECT_ALL_SCRIPT_SHA256` is a string constant next to `SELECT_ALL_SCRIPT` in `src/static/select-all.ts`; a unit test recomputes the hash with `node:crypto` and must match, so a script edit without a hash update fails `pnpm test`.
4. The stylesheet route keeps its own `Cache-Control` and gets both new headers. `nosniff` is safe there because it is served as `text/css; charset=utf-8`; every HTML response is `text/html` (`c.html`), and redirects have no body.
5. README "CSRF and headers" lists the two headers and the policy, and notes that a host app which sets its own CSP around the mounted admin must allow the same sources.

## Alternatives considered
- Move the script to a static route (`/static/select-all.js`) with `script-src 'self'`: needs a second auth-exempt route, a versioned URL for immutable caching (like `ADMIN_CSS_VERSION`), route-table and test changes. The hash needs one constant, one test and no route. Rejected as the larger change.
- Compute the hash at runtime with `crypto.subtle.digest`: asynchronous, so the policy could not be a constant built synchronously in `buildApp`; the pinned constant plus test gives the same guarantee.
- A per-request nonce: needs randomness per request and threading the nonce into `ListPage`; the script is constant, so a hash suffices.
- `default-src 'self'`: would allow any same-origin script, including endpoints of the host app; `'none'` with explicit sources is stricter, and the admin loads only its stylesheet and one inline script (no images, fonts or fetches; the stylesheet contains no `url(`, views-style.md).
- hono's `secureHeaders` middleware: adds further headers with defaults the design does not need; two explicit headers keep the change small.
- `form-action 'self'` only, also in external mode: in external mode a form submitted after the host session expired (any POST, and the GET search form) is redirected (302) to `loginUrl`. Chrome applies `form-action` to every hop of the redirect chain after a form submission (evidence: 2026-10-08-csp-hash-and-form-action), so a cross-origin `loginUrl` would be blocked.
- `form-action 'self'` plus the origin of `loginUrl` (the first version of this decision): typical SSO setups redirect again from `loginUrl` to an identity provider on another origin, which the admin cannot know, so Chrome would still show a CSP block page instead of the login; a protocol-relative `loginUrl` (`//sso.example.com/login`) would also need special parsing (design review, security-audit fix round).

## Rationale
Hash sources allow exactly one known inline script and are widely supported (evidence: 2026-10-08-csp-hash-and-form-action). The hash is over the element's text, which equals `SELECT_ALL_SCRIPT` because the script contains no character that JSX escapes (decision 007). `frame-ancestors 'none'` matches the existing `X-Frame-Options: DENY`; `base-uri 'none'` is safe because the admin renders no `<base>`; `form-action 'self'` covers every admin form, which posts to a path under the prefix, and in builtin mode every redirect after a form submission stays on the same origin (login, `safeNext`, PRG). In external mode `form-action` is omitted: multi-hop SSO redirects after a form submission cannot be listed in advance, and `form-action` is defense in depth only, since the admin has no HTML injection path (all output is JSX-escaped, decision 007 and README "CSRF and headers"). Whether the automatic favicon request is reported as blocked is unverified; it has no visible effect.

## Consequences
- routes.md (`securityHeaders(csp)`, policy text, `buildApp`), views.md (`SELECT_ALL_SCRIPT_SHA256`), project-setup.md (README "CSRF and headers"), test-strategy.md (response-headers row, hash pin test).
- Any new inline script or style, external resource or `style` attribute requires updating the policy (and this decision).
