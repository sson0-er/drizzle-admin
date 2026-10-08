# Review findings

high: 0, medium: 1, low: 3

## high


## medium

- [03-design-review] CSP form-action blocks external-mode login redirects that hop through another origin, and the origin of a protocol-relative loginUrl is missed
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md
  - detail: Middleware step 1 (decision 044) allows in form-action only 'self' plus the origin of an absolute http(s) auth.loginUrl. The cited evidence says Chrome applies form-action to redirects after a form submission. Chrome checks every hop of that redirect chain against the submitting page's policy. In external mode a form submitted after the host session expired (any POST, and also the GET search form#changelist-search) is redirected by authGuard to loginUrl. The common SSO setup then redirects again: a relative /sso/login on the host sends the browser to https://idp.example.com/authorize, or an absolute loginUrl hands off to a separate IdP origin. That second hop is not in form-action, so Chrome shows a CSP block page instead of the login. Separately, a protocol-relative loginUrl such as //sso.example.com/login makes `new URL(loginUrl)` (no base) throw. buildCsp then treats it as relative and same-origin, adds nothing, and even the first hop is blocked. createAdmin does not validate loginUrl (admin.md), so this value is accepted. Fix: in decision 044 and routes.md, either omit form-action in external mode (builtin mode only ever redirects same-origin), or resolve loginUrl against a placeholder base and document that IdP hops beyond loginUrl's origin are blocked in Chrome. If the latter, add a known-limitations line to the README outline. Add a headers.test.ts case for whichever rule is chosen.
  - evidence: 2026-10-08-csp-hash-and-form-action

## low

- [03-design-review] Failure of the cookie-key promise is not specified as handled: possible unhandled rejection and a 500 without security headers
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/routes.md
  - detail: buildApp starts the deriveCookieKey promise when admin.app is first accessed, which is often at host startup before any request. initVars is the first to await it. If the promise rejected before the first request, Node would report an unhandled rejection, and under the default --unhandled-rejections=throw the process would crash. If it rejected later, initVars would throw. securityHeaders is registered after initVars and never runs, so the onError 500 lacks the headers that test-strategy expects on every onError 500. routes.md nevertheless says initVars sets state/repo/body first 'so onError can render even if the derivation failed', which implies a handled path. Fix: either attach a handler at creation (keep the promise, plus a no-op `.catch` so the rejection is not unhandled) and accept the header-less 500, or state that rejection cannot happen with a validated secret of 32 or more characters in Web Crypto and drop the onError remark.
  - evidence: (none)
- [03-design-review] listPerPage cap and MAX_SELECTED must stay equal but are specified as two copies
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md
  - detail: admin.md register step 5 caps listPerPage at 500 as '`MAX_SELECTED` of the actions handler', so that a full page always fits a bulk action. routes-handlers.md Actions step 1 and decision 045 point 3 make `MAX_SELECTED = 500` module-private in src/routes/actions.ts. src/admin.ts therefore cannot import it and would hold its own literal 500, which must stay in sync for correctness. The CLAUDE.md conventions call for a shared definition in that case. Fix: export MAX_SELECTED (from actions.ts or a small shared constants location), have register() use it, and note the export in routes-handlers.md. Alternatively, state explicitly that admin.ts keeps its own literal.
  - evidence: (none)
- [03-design-review] Decision 045 says valueCheck is for 'key-like' columns, but it is set on every PG integer and uuid column
  - location: docs/orchestraude/decisions/045-request-input-bounds.md
  - detail: Point 1 says introspection records the domain 'of PG key-like columns'. introspect.md sets valueCheck for every column of the listed PG columnTypes, whether or not it is a key, and forms.md / point 4 depend on that for non-key int4 fields. For example, `views=3000000000` must give invalidInteger on PG. The implementation follows introspect.md, but the decision wording could lead someone to restrict the flag to PK/FK columns. Fix: change 'key-like columns' to 'columns of these PG types'.
  - evidence: (none)

