# Interface: routes (app assembly and middleware)

Files: `src/routes/index.ts` (`buildApp`), `src/routes/middleware.ts`, `src/routes/context.ts`.
Per-page behavior is in [routes-handlers.md](routes-handlers.md). Uses [auth.md](auth.md), [data.md](data.md), [forms.md](forms.md), [views.md](views.md), and `AdminState` from [admin.md](admin.md).

## Responsibilities
- Build the Hono app with relative routes, in the registration order that makes matching correct (decision 006).
- Apply security headers, Origin check, session, authentication, CSRF token check, and the error/404 handling.
- Provide a request-scoped context (`AdminVars`) to handlers.
- Resolve the request locale once, first, and expose its dictionary (Changed 2026-10-09, decisions 049, 050).

## API
Changed 2026-10-07: `renderPage` takes `opts.minimal` for error pages rendered from `onError` (decision 022).
Changed 2026-10-08: `renderPage` accepts a function `(flash) => element` that receives the consumed flash (decision 027); `buildApp` returns plain `Hono` (decision 028).
Changed 2026-10-09: `AdminVars` gains `locale` and `t` (decisions 049, 050); the chrome helpers fill the new `PageChrome` fields (decision 051).

```ts
// index.ts
export function buildApp(state: AdminState): Hono;
  // builds `new Hono<AdminEnv>()` internally and returns it cast to plain `Hono`:
  // `Admin.app` is a public `Hono` and src/admin.ts stores it as such (decision 028).

// context.ts
export interface AdminVars {
  state: AdminState;
  locale: Locale;            // readLocale(c), set by initVars (decision 050)
  t: Messages;               // MESSAGES[locale], set by initVars; the only source of UI text in routes (decision 049)
  repo: Repository;
  cookieKeys: { session: ArrayBuffer; flash: ArrayBuffer };  // derived signing keys, set by the session middleware (decision 042)
  session: Session;          // always set after the session middleware (possibly anonymous)
  user: AdminUser | null;    // builtin: session.u; external: await getUser(c.req.raw)
  body: FormBody | null;     // parsed once by the csrfToken middleware for POST; null for GET
}
export type AdminEnv = { Variables: AdminVars };
export type AdminContext = Context<AdminEnv>;   // handlers and middleware type `c` with this

export function requireUser(c: AdminContext): AdminUser;   // throws if null (guard guarantees non-null)
export function modelOr404(c: AdminContext, slug: string): ResolvedModel | Response;
  // 404 page (t.notFound) when the slug is unknown OR the model is hidden from the user:
  // !canAny(model, requireUser(c)) (decision 043). Both cases give the identical response.
export function cookieOpts(c: AdminContext): CookieOpts;   // { key: c.var.cookieKeys.session, prefix, maxAgeSec, publicOrigin }
export function flashOpts(c: AdminContext): FlashOpts;     // { key: c.var.cookieKeys.flash, prefix, publicOrigin }
export async function renderPage(
  c: AdminContext,
  status: 200 | 400 | 401 | 403 | 404 | 500,
  page: JSX.Element | ((flash: FlashMessage[]) => JSX.Element),
  opts?: { minimal?: boolean },
): Promise<Response>;
  // Consumes flash only when status is 200 or 400 and !opts.minimal; otherwise flash is [] and the
  // cookie is left untouched. If `page` is a function it is called with those messages, so the
  // page's PageChrome.flash shows exactly what was consumed for this request (decision 027).
  // A ready element is still accepted (error pages, which never show flash).
  // Returns c.html("<!DOCTYPE html>" + String(element), status).
  // `minimal` (onError only, decision 022) skips every access to session/user/flash.
export async function redirectWithFlash(c: AdminContext, location: string, msgs: FlashMessage[]): Promise<Response>;
  // addFlash then c.redirect(location, 303)
```
Rule for callers: every 200 or 400 page that is not `minimal` passes the function form and puts its `flash` argument into the page's `PageChrome`. Passing a ready element for such a page would consume the flash without displaying it.
`context.ts` may also export helpers that build the `PageChrome` (`pageChrome(c, title, trail?, flash?)`) and a synchronous `errorPage(c, status, message, opts?)` that never consumes flash; these are internal conveniences, not part of the contract above.
Changed 2026-10-09 (decisions 049, 051): every `PageChrome` built here carries `locale: c.var.locale`, `t: c.var.t` and `siteTitle: config.siteTitle ?? t.defaultSiteTitle` (`config.siteTitle` is `string | null`, admin.md), and its Home crumb uses `t.home`. `pageChrome` sets `currentUrl` to `url.pathname + url.search` with `url = new URL(c.req.url)` (raw, percent-encoded, as `safeNext` expects; decision 032); the login handler overrides it (routes-handlers.md). The minimal chrome (`errorPage(..., { minimal: true })`) sets `currentUrl: null`, so `onError` pages and the Origin-check 403 show no switcher; they still use `c.var.t`, which `initVars` set before anything could fail.
The repository is created once per `buildApp` with `createRepository({ db, dialect, timeZone })`.
Changed 2026-10-08: `modelOr404` hides models without any permission (decision 043); `cookieOpts` / `flashOpts` take the context and use the derived keys (decision 042).

Cookie keys (decision 042; Changed 2026-10-08 after the design review: derived lazily, on the first request, inside the session middleware): `buildApp` holds a memo `let keys: Promise<{ session: ArrayBuffer; flash: ArrayBuffer }> | undefined` and a closure `getCookieKeys = () => (keys ??= Promise.all([deriveCookieKey(secret, SESSION_COOKIE, prefix), deriveCookieKey(secret, FLASH_COOKIE, prefix)]).then(([session, flash]) => ({ session, flash })))` (auth.md), passed to `sessionMiddleware(state, getCookieKeys)`. The promise is created only when the session middleware calls it and is awaited in the same call, so a rejection can never be unhandled; it propagates through `next()` to `onError` (500, `minimal`), and because the session middleware runs inside `securityHeaders`, that 500 carries the security headers like any other response. The session middleware sets `c.var.cookieKeys` before reading the session, so every later middleware, handler and `renderPage` / `redirectWithFlash` reads the keys through `cookieOpts(c)` / `flashOpts(c)`. Nothing before the session middleware touches cookies (the static route, `originCheck` and its `minimal` 403). The raw `secret` is passed to no cookie function. A derivation failure is not expected (Web Crypto HMAC over a validated string secret), so a rejected memo is not retried.

Hidden models (decision 043): every model route (routes 4-9) calls `modelOr404` first. A model for which the user has none of `view`, `add`, `change`, `delete` answers exactly like an unknown slug, before any selection, body or permission check of the handler. A model with at least one granted permission keeps the per-route 403 for a missing permission.

## Middleware order (`app.use("*", ...)` in this order)
Changed 2026-10-09: `initVars` resolves the locale; the guard exempts `POST /_lang/` (decisions 050, 051).
Changed 2026-10-07: originCheck uses `publicOrigin` (decision 017); external-mode session use fixed (decision 014).
Changed 2026-10-08: `initVars` (already in the code) listed as step 0; the session middleware derives the cookie keys (decision 042); securityHeaders adds CSP and nosniff (decision 044); the external-mode `next` goes through `safeNext` (decision 047).

0. **initVars** (listed 2026-10-08): sets `state`, `repo` and `body: null`, so every later middleware, handler and `onError` can read them. Changed 2026-10-09 (decisions 049, 050): it also sets `locale = readLocale(c)` (auth.md `locale.ts`) and `t = MESSAGES[locale]`. Reading the unsigned cookie needs no derived key and never throws, so the locale is known for every response, including the static route and the Origin-check 403.
1. **securityHeaders** (`securityHeaders(csp)`; Changed 2026-10-08: CSP and nosniff added, decision 044): `await next()`, then on the final response set `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: <csp>`, all unconditionally (replacing any value already set). Set `Cache-Control: no-store` unless the response already has a `Cache-Control` header (only the static route sets one). These headers reach every response that passes through the middleware: pages, redirects, 401/403/404 pages, `onError` pages and the stylesheet.
   `csp` is built once in `buildApp` (module-private `buildCsp(authMode)` in `middleware.ts`). Builtin mode:
   ```
   default-src 'none'; script-src 'sha256-<SELECT_ALL_SCRIPT_SHA256>'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'
   ```
   External mode: the same string without the `form-action 'self'; ` directive. Changed 2026-10-08 (design review): `form-action` is omitted in external mode instead of being widened by the `loginUrl` origin. Why: there a form submitted after the host session expired is redirected (302) to `loginUrl`, typical SSO setups redirect again to an identity provider on another origin, and Chrome checks every hop against `form-action` (evidence: 2026-10-08-csp-hash-and-form-action); `form-action` is defense in depth only, because the admin has no HTML injection path (decision 044). Nothing parses `auth.loginUrl`, so `createAdmin` does not validate it.
   `SELECT_ALL_SCRIPT_SHA256` comes from `src/static/select-all.ts` (views.md).
   The admin loads only its stylesheet (`style-src 'self'`) and the inline select-all script; it uses no images, fonts, fetches, `<base>`, `style` attributes or inline event handlers, so `default-src 'none'` blocks nothing it needs. Any new resource type or inline script requires a policy change (decision 044).
2. **static**: `GET /static/admin.css` is registered as a route before the auth middleware runs for it (see "Auth exemptions"). Response: `ADMIN_CSS`, `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`.
3. **originCheck** (`originCheck(config.publicOrigin)`, auth.md): for unsafe-method form posts, passes when `Sec-Fetch-Site: same-origin` or Origin equals the expected origin; otherwise 403 (evidence: 2026-10-07-hono-csrf-and-jsx). The expected origin is `config.publicOrigin` when set, else the request URL origin (evidence: 2026-10-07-hono-csrf-origin-option).
4. **session** (`sessionMiddleware(state, getCookieKeys)`): first `c.set("cookieKeys", await getCookieKeys())` (see "Cookie keys" above), then `readSession` with `cookieOpts(c)` = `CookieOpts { key: cookieKeys.session, prefix, maxAgeSec: sessionMaxAgeSec, publicOrigin }` (Changed 2026-10-08: derived key, decision 042). If `null`: for GET/HEAD, create `newSession(null, now)` and `writeSession`; for other methods keep a transient anonymous session without writing it (its token cannot match, so the token check fails with 403). Set `c.var.session`. This is identical in both auth modes; in external mode the session always has `u: null` and only carries the CSRF token and issue time (decision 014).
5. **user**: builtin → `session.u`; external → `await auth.getUser(c.req.raw)` (`session.u` ignored). Set `c.var.user`. In external mode the token is not rotated when `getUser` starts returning a different user; it rotates only when the session expires (decision 014).
6. **authGuard** (skipped for exemptions; Changed 2026-10-09: `POST /_lang/` is exempt in both modes, decision 051): if `user === null`:
   Changed 2026-10-08: `path` below is the raw percent-encoded pathname `new URL(c.req.url).pathname`, not `c.req.path` (which decodes `%20` to a space that `safeNext` rejects), and `search` is `new URL(c.req.url).search` (decision 032).
   Changed 2026-10-08: HEAD is treated like GET (decision 033 item 7).
   - builtin → `302` to `loginRedirectUrl(prefix, path + search)` for GET and HEAD; for other methods use `next = <prefix>/`. Hono dispatches HEAD through the GET routes but `c.req.method` stays `"HEAD"` (evidence: 2026-10-08-hono-head-cookie-body-node-server), so the guard checks both methods explicitly.
   - external with `loginUrl` → `302` to `externalLoginUrl(loginUrl, safeNext(path + search, prefix))` (Changed 2026-10-08, decision 047: an unsafe target such as `//evil.com/` with basePath `"/"` becomes `${prefix}/`; every method, as before).
   - external without `loginUrl` → 401 error page.
7. **csrfToken**: for POST, parse the body once (`c.req.parseBody({ all: true })`, kept in a context variable for handlers) and require `typeof body._csrf === "string" && tokensEqual(body._csrf, session.csrf)`; otherwise 403 error page (`t.csrfFailed`). Accepted (decision 051 point 8): when the session was transient (not written), that 403 page shows the switcher with a token that can never validate; the next GET issues a session.

Auth exemptions: `GET /static/admin.css`, and `GET|POST /login/` in builtin mode. Like every GET route, these also answer HEAD (Hono serves HEAD through GET routes), and the guard exempts `HEAD /login/` too.
Changed 2026-10-09 (decision 051): `POST /_lang/` is exempt in both auth modes, so the switcher works on the login page and on the external-mode 401 page. It still passes the Origin check and the token check; a logged-out visitor's token comes from the anonymous session the session middleware writes on GET.
Order rationale: the guard runs before the token check, so a logged-out user who submits a form is sent to login rather than given 403. The login POST is exempt from the guard but not from the token check.

## Route table (registered in this order; paths relative to the mount point)
Changed 2026-10-09: route 3a `POST /_lang/` and the reserved slug `_lang` (decision 051; Q15 option (b)).
Changed 2026-10-07: explicit all-methods fallback (route 11) instead of `app.notFound` (decision 022).

Order matters: the first registered matching handler wins, and a mounted `"/"` route never matches `<prefix>/` (evidence: 2026-10-07-hono-routing-cookies-script-escaping).
| # | Method | Path | Handler (routes-handlers.md) | Permission |
|---|---|---|---|---|
| 1 | GET | `/static/admin.css` | static | none |
| 2 | GET, POST | `/login/` | login (builtin only; external → 404) | none |
| 3 | POST | `/logout/` | logout (builtin only; external → 404) | logged in |
| 3a | POST | `/_lang/` | language switch (both modes; Changed 2026-10-09, decision 051) | none (guard-exempt; Origin and token checks apply) |
| 4 | GET | `/:model/` | list | view (routes 4-9: a model with no permission for the user → 404, decision 043) |
| 5 | POST | `/:model/` | action | per action |
| 6 | GET, POST | `/:model/add/` | add | add |
| 7 | GET | `/:model/:pk/change/` | change (read-only without change perm) | view |
| 8 | POST | `/:model/:pk/change/` | change submit | change |
| 9 | GET, POST | `/:model/:pk/delete/` | delete | delete |
| 10 | GET | `/*` | catch-all | see below |
| 11 | ALL | `/*` | fallback: 404 page | none (middleware still applies) |

Changed 2026-10-08: no redirect when the path after the prefix starts with `//` or contains `\` (open redirect with basePath "/", decision 029).
Changed 2026-10-08: the denylist was bypassed with a tab (`GET /%09/evil.example` → `Location: /\t/evil.example/`, which browsers read as `//evil.example/`); replaced by an allowlist (decision 029).
Changed 2026-10-08: segments also exclude whitespace (`\s`); the decoded LF/CR 404 is an accepted known limitation (decision 029).

The catch-all compares `c.req.path` (percent-decoded by Hono) with `prefix`. Let `rest = path.slice(prefix.length)`. Checked in this order:
1. `path === prefix + "/"` → dashboard (requires a logged-in user; no model permission). With basePath "/" this is `GET /`.
2. `rest === ""` (the bare prefix, e.g. `GET /admin`; never true with prefix `""`) → `301` to `prefix + "/" + search`.
3. `rest` matches the allowlist → `301` to `path + "/" + search`. Allowlist: a single leading `/` followed by one or more non-empty segments separated by single `/`; no segment contains `\`, a control character (U+0000-U+001F, U+007F) or whitespace (JS `\s`: space, tab-to-CR, U+00A0, U+1680, U+2000-U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF). Reference pattern:
   ```ts
   const SAFE_REST = /^(?:\/[^\/\\\s\u0000-\u001F\u007F]+)+$/;
   ```
   So `rest` never contains `//`, never ends with `/`, and never contains `\`, a control character or whitespace; `GET /a%20b` is a 404. Other characters (non-ASCII letters, `%` from a double-encoded path) are allowed.
4. otherwise → 404 page (`errorPage(c, 404, t.notFound)`), without a `Location` header.

`search` is `new URL(c.req.url).search` (empty or starting with `?`), appended unchanged.

Why: with basePath "/" the prefix is `""`, so `GET //evil.example` would redirect to `//evil.example/` and `GET /%5Cevil.example` to `/\evil.example/`; browsers follow both to another host (evidence: 2026-10-08-trailing-slash-open-redirect). Browsers also strip tab, LF and CR while parsing a URL, so `/\t/evil.example/` resolves to `https://evil.example/`; a denylist cannot keep up with such quirks, an allowlist can (evidence: 2026-10-08-trailing-slash-control-char-bypass). The check applies to every prefix.

Paths whose decoded form contains LF or CR (`%0a`, `%0d`; also U+2028) never reach this route: Hono's `/*` does not match them, so no admin route or middleware runs, and Hono's default (or, when mounted, the host app's) 404 answers without a `Location` and without the admin's security headers (evidence: 2026-10-08-trailing-slash-control-char-bypass). Known limitation, accepted (decision 029, former Q6): no `app.notFound` handler is added, because it would only cover `admin.fetch` (a mounted sub-app's `notFound` is ignored).
Any other method/path → route 11 → 404 page. A sub-app's `notFound` is not relied on: as a route, the fallback is included when the app is mounted with `app.route()` and in `admin.fetch` (decision 022; Hono ignores a mounted sub-app's `notFound` and uses the parent's, evidence: 2026-10-08-trailing-slash-control-char-bypass). An unmatched POST still passes the auth guard and the token check first, so without a valid token it is 403 (or a login redirect), and with a valid token it is 404.

Slugs `login`, `logout`, `static` and (Changed 2026-10-09, decision 051) `_lang` are reserved (admin.md), so routes 2-3a never shadow a model. `GET /_lang/` has no route of its own; it reaches route 4 and answers 404 (no model has that slug).

Flash cookie options passed by `renderPage` / `redirectWithFlash`: `flashOpts(c)` = `FlashOpts { key: c.var.cookieKeys.flash, prefix, publicOrigin }` (Changed 2026-10-08, decision 042).
All `Location` headers built by routes and the catch-all are path-only (`${prefix}/...`), so they are correct behind a reverse proxy without using `publicOrigin`.
Invariant (Changed 2026-10-08, decision 029; Changed 2026-10-08: control characters added after the tab bypass): every `Location` is a single-slash path under the prefix. It starts with `${prefix}/`, never starts with `//`, and never contains `\` or a control character (U+0000-U+001F, U+007F). User-supplied targets (`next` of the login and, Changed 2026-10-09, of the language switch, decision 051) go through `safeNext` (auth.md), and the catch-all applies the rule above. The only exception is the external-mode login redirect to the operator-configured `auth.loginUrl` (authGuard step 6), which is configuration, not request input; its `next` value is a `safeNext` result, so it satisfies this invariant too (decision 047).

## Error handling
Changed 2026-10-07: `HTTPException` renders the layout error page; full logging for non-DB errors (decision 022).

- `app.onError(err)`:
  - `HTTPException` (from `hono/csrf`) → `ErrorPage` with `err.status`, message `t.csrfFailed` for 403 and `t.serverError` otherwise (`t = c.var.t`; Changed 2026-10-09, decision 049). Security headers are applied as for every response.
  - Anything else → log, then the 500 error page. Log `console.error("drizzle-admin:", describeForLog(err))` when `isDbError(err)` (data.md), because DB errors may carry SQL and bound parameters. Otherwise log `console.error("drizzle-admin:", err)` in full (message and stack), for example for bugs in formatters, `toString`, `validate` or `getUser`.
  - Pages rendered from `onError` must not assume that the middleware ran (the Origin check runs before the session). They use a minimal chrome: `user: null`, `showLogout: false`, `csrfToken: ""`, and no flash read or consumed. `renderPage` takes an optional `{ minimal: true }` for this.
- 404 page: `ErrorPage` with `t.notFound`. 403 page: `t.forbidden` or `t.csrfFailed`. Log lines stay English (decision 049 point 6).
- Permission checks happen inside handlers through `can()` before any DB write or data read for that model. A model hidden from the user (no permission at all) is a 404 from `modelOr404`, never a 403 (Changed 2026-10-08, decision 043).
