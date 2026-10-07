# 029: Trailing-slash catch-all never redirects off-site

- Date: 2026-10-08
- Status: accepted

## Context
Task 14 review (high): the catch-all rule "path not ending in `/` → 301 to path + `/` + search" (decision 006) is an open redirect when basePath is "/" (prefix `""`). `GET //evil.example` gave `Location: //evil.example/` and `GET /%5Cevil.example` gave `Location: /\evil.example/`, both protocol-relative to another host in browsers.

Changed 2026-10-08: the first version of this decision used a denylist (no redirect when `rest` starts with `//` or contains `\`). Review bypassed it: with basePath "/", `GET /%09/evil.example` returns `301 Location: /\t/evil.example/` because Hono decodes `%09` into a literal tab, and browsers strip tab, LF and CR while parsing a URL, so the Location resolves to `//evil.example/` (evidence: 2026-10-08-trailing-slash-control-char-bypass). A denylist has to anticipate every character browsers drop, so it is replaced by an allowlist.

## Decision
Changed 2026-10-08: allowlist replaces the denylist (bypass above).
Changed 2026-10-08: segments also exclude whitespace, matching the implementation (user decision); paths with a decoded LF/CR are accepted as a known limitation (user decision, former Q6).

Let `rest = path.slice(prefix.length)`, where `path` is `c.req.path` (percent-decoded). The catch-all, after the dashboard case (`path === prefix + "/"`), redirects with `301` to `path + "/" + search` only when one of these holds:
- `rest === ""` (the bare prefix, e.g. `/admin`; impossible with prefix `""`), or
- `rest` is a single leading `/` followed by one or more non-empty segments separated by single `/`, and no segment contains a control character (U+0000-U+001F, U+007F), whitespace (JS `\s`: space, tab-to-CR, U+00A0, U+1680, U+2000-U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF) or `\`. Reference pattern: `/^(?:\/[^\/\\\s\u0000-\u001F\u007F]+)+$/`. So `/a%20b` returns 404, not 301. This excludes `//` anywhere and a trailing `/`.

Anything else renders the 404 page with no `Location` header. Invariant: every `Location` the routes emit is a single-slash path under the prefix (`${prefix}/...`), never starts with `//`, and contains no `\` and no control character. The rule applies to every prefix, not only `""`.

Paths whose decoded form contains LF or CR (also U+2028) never reach the catch-all: Hono's `/*` does not match them, so no admin route or middleware runs and Hono (or the host app when mounted) answers 404 without a `Location` (evidence: 2026-10-08-trailing-slash-control-char-bypass). The security invariant holds. Known limitation, accepted by the user (2026-10-08, former Q6, option (a)): such responses are not the admin 404 page and carry none of the admin's security headers (`X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`). No `app.notFound` handler is added; tests assert only the 404 status and the missing `Location`.

## Alternatives considered
- Keep the denylist and add tab, LF, CR (and other characters browsers drop): has to track URL-parser quirks forever; one missed character is an open redirect again.
- Collapse repeated slashes and strip control characters / replace `\` before redirecting: still redirects on attacker-shaped URLs and invents canonicalization the requirements do not ask for.
- Redirect to an absolute URL built from `publicOrigin` / the request origin: needs the origin everywhere and contradicts "Locations are path-only" (routes.md).
- Forbid basePath "/": removes a supported configuration.
- Allow whitespace in segments (first allowlist version): safe as far as known, but the implementation already rejects `\s` and admin slugs and primary keys never need whitespace in an unslashed URL; the user chose to match the implementation.
- For decoded LF/CR paths, add `app.notFound` on the admin app rendering the minimal 404 page with the security headers: helps `admin.fetch` only, because Hono ignores a mounted sub-app's `notFound` (evidence: 2026-10-08-trailing-slash-control-char-bypass); rejected by the user in favour of documenting the limitation.

## Rationale
User decisions (2026-10-08) from the high review finding and from the review of the first fix. The allowlist accepts only shapes that cannot be read as a protocol-relative URL once a browser drops tab/LF/CR, because none of those characters (nor `\` or an empty segment) can appear (evidence: 2026-10-08-trailing-slash-control-char-bypass). Ordinary unslashed paths (`/users?a=1` → `/users/?a=1`) and percent-encoded `%2F%2F` (which stays encoded in the Location) keep working (evidence: 2026-10-08-trailing-slash-open-redirect, 2026-10-08-trailing-slash-control-char-bypass). Whitespace is excluded as well (user decision 2026-10-08, matching src/routes/index.ts); this costs only the trailing-slash redirect for paths with whitespace, which then get the 404 page. Other non-ASCII characters stay allowed: browsers percent-encode them in a path, so they keep the redirect same-site (unverified for every browser; Node's WHATWG URL only). The LF/CR limitation was accepted because it is not a redirect and covering it would only work for `admin.fetch` (user decision 2026-10-08).

## Consequences
- Amends decision 006 (catch-all) and routes.md.
- test-strategy.md has `basePath: "/"` and `"/admin"` cases for `//`, `\`, tab, LF, CR, `///` and `%20` paths, plus ordinary redirects and `GET /`.
- Paths with decoded LF/CR get Hono's or the host's plain 404 without the admin's security headers (known limitation, listed in the README outline's known limitations, project-setup.md).
