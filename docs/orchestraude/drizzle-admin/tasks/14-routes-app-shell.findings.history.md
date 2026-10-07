## Round 1

# Review findings

high: 1, medium: 0, low: 8

## high

- [security] Open redirect in trailing-slash catch-all when basePath is "/"
  - location: src/routes/index.ts:26
  - detail: The catch-all builds Location from the raw request path: `${path}/${search}`. With basePath "/" (accepted by normalizeBasePath; prefix becomes ""), every path reaches the catch-all, so `GET //evil.example` returns `301 Location: //evil.example/`, a protocol-relative URL to another host. `GET /%5Cevil.example` returns `301 Location: /\evil.example/`, which browsers also treat as `//evil.example/`. Both were reproduced with admin.fetch, and the 301 is cached permanently by browsers. This breaks the routes.md rule that all Location headers are path-only (`${prefix}/...`), and it makes the admin's trusted origin usable for phishing links. Fix: before redirecting, return the 404 page (or collapse the slashes) when the part after the prefix starts with `//` or contains a backslash, i.e. redirect only when `path.slice(prefix.length)` matches /^\/(?![\/\\])/ and has no `\`. Add a pages test with basePath "/" for `//evil.example` and `/%5Cevil.example` (expect no 301, or a Location that starts with a single `/` followed by a non-slash, non-backslash character). The design text in routes.md ("301 to path + '/' + search") has the same gap and should be amended to match.
  - evidence: (none)

## medium


## low

- [quality] initVars repo parameter uses an indirect type
  - location: src/routes/middleware.ts:19
  - detail: `repo: AdminEnv["Variables"]["repo"]` is a roundabout way to write `Repository`; import the type from ../data/repository.js for clearer intent.
  - evidence: (none)
- [security] POST body parsed without a size limit
  - location: src/routes/middleware.ts:63
  - detail: csrfToken calls `c.req.parseBody({ all: true })` on every POST before the token is checked, so an unauthenticated client can make the server buffer an arbitrarily large urlencoded or multipart body in memory. Consider adding `hono/body-limit` (for example a few MB) before csrfToken, or documenting that a reverse proxy must enforce a limit.
  - evidence: (none)
- [spec] Home breadcrumb has no link on the dashboard and on in-chain error pages
  - location: src/routes/context.ts:64
  - detail: views.md (PageChrome) says 'first item is always Home -> `${prefix}/`', but pageChrome leaves out the href when the trail is empty. Because of this, the non-minimal 404 page (route 11, modelOr404) and the CSRF 403 page show Home as plain text, while the minimal onError pages link it. Leaving the link off on the dashboard itself is defensible, but on error pages the user is not on Home. Fix: always set href, or leave it out only in dashboardHandler (for example with a flag, or by having errorPage pass its own crumbs).
  - evidence: (none)
- [spec] design ambiguity: renderPage accepts a (flash) => element function in addition to an element
  - location: src/routes/context.ts:114
  - detail: routes.md declares `page: JSX.Element` and says renderPage consumes flash for 200/400. It also says callers build the PageChrome, but it does not say how the consumed flash reaches that chrome. The function form solves this and is recorded in History. The orchestrator should confirm the signature with the user so that tasks 15-21 build on an agreed API, and the design should be updated if it is accepted.
  - evidence: (none)
- [spec] design ambiguity: buildApp returns plain Hono instead of Hono<{ Variables: AdminVars }>
  - location: src/routes/index.ts:31
  - detail: routes.md declares `buildApp(state): Hono<{ Variables: AdminVars }>`. The implementation returns `app as unknown as Hono` because src/admin.ts (Do not touch) stores the result as `Hono`. History records this. Runtime behavior is unaffected. Either the design signature or admin.ts should change; the orchestrator should decide which.
  - evidence: (none)
- [tests] Wrong-token and no-session CSRF tests assert only the status
  - location: test/pages.test.ts:97
  - detail: 'rejects a wrong token' and 'rejects a POST without a session cookie' check only status 403. They would also pass if some other 403 source answered. Assert the messages.csrfFailed text, as the no-token test does, or fold the three cases into one it.each.
  - evidence: (none)
- [tests] Mounted-app POST test does not show that the token was valid
  - location: test/pages.test.ts:67
  - detail: The POST under the outer Hono app relies on client.post adding a token taken from the session cookie fallback. A 404 therefore shows the CSRF check passed, but the test never states that. Add a one-line comment, or assert that the response is not 403, to make the intent clear.
  - evidence: (none)
- [tests] Static CSS test asserts no Set-Cookie but headers test omits no-session case
  - location: test/headers.test.ts:55
  - detail: The static CSS test in headers.test.ts duplicates the status and Cache-Control assertions already made in pages.test.ts. Keep it for the hardening headers, but the duplication could be reduced.
  - evidence: (none)


### Implementer response after round 1

buildApp now returns the real Hono app: init vars, securityHeaders, static CSS route, originCheck, session (anonymous session written on GET/HEAD only), user (PRE_AUTH_USER fallback in builtin mode, getUser in external mode), csrfToken (POST only, body parsed once into c.var.body), a marked placeholder for routes 2-9, route 10 catch-all (dashboard / 301 / 404), route 11 all-methods 404 fallback, and onError (HTTPException -> minimal ErrorPage, other errors logged via describeForLog for DB errors else in full, then minimal 500). context.ts has AdminVars, requireUser, modelOr404, renderPage (accepts a ready element or a (flash) => element function so 200/400 pages receive the flash they consumed), redirectWithFlash, plus pageChrome and errorPage helpers. dashboard.ts renders the dashboard. test/helpers/app.ts provides makeAdmin and a cookie-jar createClient with csrf(). Deviations, all recorded in the task History: added internal type FormBody to src/types.ts; buildApp is typed to return plain Hono (cast from the internal Hono<AdminEnv>) because src/admin.ts and Admin.app use Hono and cannot be touched; test/register.test.ts (outside the Scope list) had its fetch smoke test changed to /admin/anything/ since the unslashed path is now a 301. No review findings to address yet. Fix round: the high finding (open redirect in the catch-all with basePath "/") is fixed. A path whose remainder after the prefix starts with `//` or contains a backslash now gets the 404 page instead of a 301. Tests cover `//evil.example` and `/%5Cevil.example`, plus an ordinary redirect with basePath "/". Also fixed low findings: initVars uses the Repository type; the Home breadcrumb links on error pages and only the dashboard leaves it unlinked; the wrong-token and no-session tests assert csrfFailed; the mounted POST test comments why 404 proves a valid token. Not changed: the POST body size limit (a reverse proxy concern, out of this task's scope; no design requirement); the two design-ambiguity findings (renderPage function form, buildApp return type), which are orchestrator decisions, recorded in History; the static CSS test duplication (it also asserts the hardening headers). The routes.md text for the 301 rule is not amended because docs are out of scope.

## Round 2

# Review findings

high: 2, medium: 0, low: 1

## high

- [security] Catch-all redirect guard bypassed with a percent-encoded tab (%09)
  - location: src/routes/index.ts:29
  - detail: Hono percent-decodes c.req.path with decodeURI, so `%09` becomes a literal TAB. With basePath "/", `GET /%09/evil.example` passes the new guard: rest is "/\t/evil.example", which does not start with "//" and contains no backslash. The response is `301 Location: "/\t/evil.example/"` (reproduced with admin.fetch through the test client, hono 4.13.13). The WHATWG URL parser that browsers use removes every ASCII tab and newline from the input before parsing, so the browser resolves this Location as `//evil.example/`, a protocol-relative URL to another host. The browser also caches the 301 permanently. This is the same open redirect as the round-1 finding, and it breaks the decision 029 invariant that every Location is a single-slash path under the prefix. `%0A` and `%0D` returned 404 in the probe and `%2F` stays encoded, so TAB is the only working bypass found. Suggested fix: redirect only when rest contains no backslash and no C0 control or DEL character (for example, require `!/[\x00-\x1f\x7f\\]/.test(rest)` in addition to the existing `!rest.startsWith("//")` check). A more robust option is to check the built target with the URL parser itself: `new URL(target, "http://h").host === "h"`, and also confirm that its pathname starts with `${prefix}/` and not with `//`. Add `/%09/evil.example` (and preferably `/%09%09/evil.example` and `/%5C%09evil.example`) to the `it.each` in test/pages.test.ts:125. Update decision 029 and the routes.md catch-all rule to cover control characters.
  - evidence: (none)
- [spec] Trailing-slash open redirect still reachable through an encoded tab
  - location: src/routes/index.ts:29
  - detail: The guard only checks whether `rest` starts with `//` or contains `\`. Hono percent-decodes the path, so with basePath "/" a request to `GET /%09/evil.example` has path `/\t/evil.example`. That passes the guard and returns `301 Location: /\t/evil.example/`. The WHATWG URL parser, which browsers use to resolve Location, strips ASCII tab and newline before parsing, so this resolves to `http://evil.example/`. I reproduced this against the current tree with admin.fetch, resolving the Location with `new URL(loc, "http://localhost/")` gives `http://evil.example/`. With basePath "/admin" the same input stays on-site (`/admin//evil.example/`). `%0A` and `%0D` already produce 404. In substance this breaks the decision 029 / routes.md invariant that every Location is a single-slash path under the prefix and never points off-site. Fix: do not redirect when `rest` contains any ASCII control character (`/[\u0000-\u001F\u007F]/`), in addition to the `//` and `\` checks. A safer alternative is to strip `[\t\n\r]` from `rest` and then apply the `//` and `\` checks to the result. Add `/%09/evil.example` to the basePath "/" test, expecting 404 with no Location. Decision 029 and the routes.md catch-all rule state only `//` and `\`, so the orchestrator should amend them to cover this too.
  - evidence: (none)

## medium


## low

- [spec] Some trailing-slash cases listed in test-strategy.md are not tested
  - location: test/pages.test.ts:124
  - detail: The updated test-strategy.md bullet (decision 029) also lists `GET ///evil.example` -> 404 and `GET /` -> dashboard 200 with basePath "/", plus `GET /admin//evil.example` and `GET /admin/%5Cevil.example` -> 404 without Location with basePath "/admin". The new describe block covers only `//evil.example`, `/%5Cevil.example` and `/authors?x=1` with basePath "/". I probed the current code and it behaves correctly for all of the missing cases. The task DoD does not list them, so adding them to the it.each, together with a basePath "/admin" variant, would close the gap with the design.
  - evidence: (none)


### Implementer response after round 2

buildApp now returns the real Hono app: init vars, securityHeaders, static CSS route, originCheck, session (anonymous session written on GET/HEAD only), user (PRE_AUTH_USER fallback in builtin mode, getUser in external mode), csrfToken (POST only, body parsed once into c.var.body), a marked placeholder for routes 2-9, route 10 catch-all (dashboard / 301 / 404), route 11 all-methods 404 fallback, and onError (HTTPException -> minimal ErrorPage, other errors logged via describeForLog for DB errors else in full, then minimal 500). context.ts has AdminVars, requireUser, modelOr404, renderPage (accepts a ready element or a (flash) => element function so 200/400 pages receive the flash they consumed), redirectWithFlash, plus pageChrome and errorPage helpers. dashboard.ts renders the dashboard. test/helpers/app.ts provides makeAdmin and a cookie-jar createClient with csrf(). Deviations, all recorded in the task History: added internal type FormBody to src/types.ts; buildApp is typed to return plain Hono (cast from the internal Hono<AdminEnv>) because src/admin.ts and Admin.app use Hono and cannot be touched; test/register.test.ts (outside the Scope list) had its fetch smoke test changed to /admin/anything/ since the unslashed path is now a 301. No review findings to address yet. Fix round 2: both high findings (catch-all open redirect via an encoded tab) are fixed by replacing the denylist with an allowlist (SAFE_REST in src/routes/index.ts). The part after the prefix must be empty or one or more /segment pieces with no slash, backslash, whitespace or control character in a segment; anything else gets the 404 page with no Location. test/pages.test.ts now covers, for basePath / and /admin, //evil.example, ///evil.example, %5C, %09, %09%09, %5C%09, %0a and %0d variants; GET / returning the dashboard with basePath /; and /users?a=1 still redirecting to /users/?a=1 (the bare /admin redirect stays covered by the main tests). The earlier round-1 fixes (initVars type, Home breadcrumb, stronger CSRF test assertions) stay. Not changed: POST body size limit (reverse-proxy concern, not in the design), the renderPage function form and buildApp return type (orchestrator design decisions, recorded in History), static CSS test duplication (it also asserts hardening headers). routes.md and decision 029 are not amended because docs are out of scope; History says they should state the allowlist.

