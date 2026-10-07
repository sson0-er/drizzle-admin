# Interface: routes (app assembly and middleware)

Files: `src/routes/index.ts` (`buildApp`), `src/routes/middleware.ts`, `src/routes/context.ts`.
Per-page behavior is in [routes-handlers.md](routes-handlers.md). Uses [auth.md](auth.md), [data.md](data.md), [forms.md](forms.md), [views.md](views.md), and `AdminState` from [admin.md](admin.md).

## Responsibilities
- Build the Hono app with relative routes, in the registration order that makes matching correct (decision 006).
- Apply security headers, Origin check, session, authentication, CSRF token check, and the error/404 handling.
- Provide a request-scoped context (`AdminVars`) to handlers.

## API
Changed 2026-10-07: `renderPage` takes `opts.minimal` for error pages rendered from `onError` (decision 022).
Changed 2026-10-08: `renderPage` accepts a function `(flash) => element` that receives the consumed flash (decision 027); `buildApp` returns plain `Hono` (decision 028).

```ts
// index.ts
export function buildApp(state: AdminState): Hono;
  // builds `new Hono<AdminEnv>()` internally and returns it cast to plain `Hono`:
  // `Admin.app` is a public `Hono` and src/admin.ts stores it as such (decision 028).

// context.ts
export interface AdminVars {
  state: AdminState;
  repo: Repository;
  session: Session;          // always set after the session middleware (possibly anonymous)
  user: AdminUser | null;    // builtin: session.u; external: await getUser(c.req.raw)
  body: FormBody | null;     // parsed once by the csrfToken middleware for POST; null for GET
}
export type AdminEnv = { Variables: AdminVars };
export type AdminContext = Context<AdminEnv>;   // handlers and middleware type `c` with this

export function requireUser(c: AdminContext): AdminUser;   // throws if null (guard guarantees non-null)
export function modelOr404(c: AdminContext, slug: string): ResolvedModel | Response;
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
The repository is created once per `buildApp` with `createRepository({ db, dialect, timeZone })`.

## Middleware order (`app.use("*", ...)` in this order)
Changed 2026-10-07: originCheck uses `publicOrigin` (decision 017); external-mode session use fixed (decision 014).

1. **securityHeaders**: `await next()`, then on the final response set `X-Frame-Options: DENY` and `Referrer-Policy: same-origin`. Set `Cache-Control: no-store` unless the response already has a `Cache-Control` header (only the static route sets one).
2. **static**: `GET /static/admin.css` is registered as a route before the auth middleware runs for it (see "Auth exemptions"). Response: `ADMIN_CSS`, `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`.
3. **originCheck** (`originCheck(config.publicOrigin)`, auth.md): for unsafe-method form posts, passes when `Sec-Fetch-Site: same-origin` or Origin equals the expected origin; otherwise 403 (evidence: 2026-10-07-hono-csrf-and-jsx). The expected origin is `config.publicOrigin` when set, else the request URL origin (evidence: 2026-10-07-hono-csrf-origin-option).
4. **session**: `readSession` with `CookieOpts { secret, prefix, maxAgeSec: sessionMaxAgeSec, publicOrigin }`. If `null`: for GET/HEAD, create `newSession(null, now)` and `writeSession`; for other methods keep a transient anonymous session without writing it (its token cannot match, so the token check fails with 403). Set `c.var.session`. This is identical in both auth modes; in external mode the session always has `u: null` and only carries the CSRF token and issue time (decision 014).
5. **user**: builtin → `session.u`; external → `await auth.getUser(c.req.raw)` (`session.u` ignored). Set `c.var.user`. In external mode the token is not rotated when `getUser` starts returning a different user; it rotates only when the session expires (decision 014).
6. **authGuard** (skipped for exemptions): if `user === null`:
   - builtin → `302` to `loginRedirectUrl(prefix, path + search)`; for non-GET requests use `next = <prefix>/`.
   - external with `loginUrl` → `302` to `externalLoginUrl(loginUrl, path + search)`.
   - external without `loginUrl` → 401 error page.
7. **csrfToken**: for POST, parse the body once (`c.req.parseBody({ all: true })`, kept in a context variable for handlers) and require `typeof body._csrf === "string" && tokensEqual(body._csrf, session.csrf)`; otherwise 403 error page (`messages.csrfFailed`).

Auth exemptions: `GET /static/admin.css`, and `GET|POST /login/` in builtin mode.
Order rationale: the guard runs before the token check, so a logged-out user who submits a form is sent to login rather than given 403. The login POST is exempt from the guard but not from the token check.

## Route table (registered in this order; paths relative to the mount point)
Changed 2026-10-07: explicit all-methods fallback (route 11) instead of `app.notFound` (decision 022).

Order matters: the first registered matching handler wins, and a mounted `"/"` route never matches `<prefix>/` (evidence: 2026-10-07-hono-routing-cookies-script-escaping).
| # | Method | Path | Handler (routes-handlers.md) | Permission |
|---|---|---|---|---|
| 1 | GET | `/static/admin.css` | static | none |
| 2 | GET, POST | `/login/` | login (builtin only; external → 404) | none |
| 3 | POST | `/logout/` | logout (builtin only; external → 404) | logged in |
| 4 | GET | `/:model/` | list | view |
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
4. otherwise → 404 page (`errorPage(c, 404, messages.notFound)`), without a `Location` header.

`search` is `new URL(c.req.url).search` (empty or starting with `?`), appended unchanged.

Why: with basePath "/" the prefix is `""`, so `GET //evil.example` would redirect to `//evil.example/` and `GET /%5Cevil.example` to `/\evil.example/`; browsers follow both to another host (evidence: 2026-10-08-trailing-slash-open-redirect). Browsers also strip tab, LF and CR while parsing a URL, so `/\t/evil.example/` resolves to `https://evil.example/`; a denylist cannot keep up with such quirks, an allowlist can (evidence: 2026-10-08-trailing-slash-control-char-bypass). The check applies to every prefix.

Paths whose decoded form contains LF or CR (`%0a`, `%0d`; also U+2028) never reach this route: Hono's `/*` does not match them, so no admin route or middleware runs, and Hono's default (or, when mounted, the host app's) 404 answers without a `Location` and without the admin's security headers (evidence: 2026-10-08-trailing-slash-control-char-bypass). Known limitation, accepted (decision 029, former Q6): no `app.notFound` handler is added, because it would only cover `admin.fetch` (a mounted sub-app's `notFound` is ignored).
Any other method/path → route 11 → 404 page. A sub-app's `notFound` is not relied on: as a route, the fallback is included when the app is mounted with `app.route()` and in `admin.fetch` (decision 022; Hono ignores a mounted sub-app's `notFound` and uses the parent's, evidence: 2026-10-08-trailing-slash-control-char-bypass). An unmatched POST still passes the auth guard and the token check first, so without a valid token it is 403 (or a login redirect), and with a valid token it is 404.

Slugs `login`, `logout` and `static` are reserved (admin.md), so routes 2-3 never shadow a model.

Flash cookie options passed by `renderPage` / `redirectWithFlash`: `FlashOpts { secret, prefix, publicOrigin }` from `state.config`.
All `Location` headers built by routes and the catch-all are path-only (`${prefix}/...`), so they are correct behind a reverse proxy without using `publicOrigin`.
Invariant (Changed 2026-10-08, decision 029; Changed 2026-10-08: control characters added after the tab bypass): every `Location` is a single-slash path under the prefix. It starts with `${prefix}/`, never starts with `//`, and never contains `\` or a control character (U+0000-U+001F, U+007F). User-supplied targets (`next`) go through `safeNext` (auth.md), and the catch-all applies the rule above. The only exception is the external-mode login redirect to the operator-configured `auth.loginUrl` (authGuard step 6), which is configuration, not request input.

## Error handling
Changed 2026-10-07: `HTTPException` renders the layout error page; full logging for non-DB errors (decision 022).

- `app.onError(err)`:
  - `HTTPException` (from `hono/csrf`) → `ErrorPage` with `err.status`, message `messages.csrfFailed` for 403 and `messages.serverError` otherwise. Security headers are applied as for every response.
  - Anything else → log, then the 500 error page. Log `console.error("drizzle-admin:", describeForLog(err))` when `isDbError(err)` (data.md), because DB errors may carry SQL and bound parameters. Otherwise log `console.error("drizzle-admin:", err)` in full (message and stack), for example for bugs in formatters, `toString`, `validate` or `getUser`.
  - Pages rendered from `onError` must not assume that the middleware ran (the Origin check runs before the session). They use a minimal chrome: `user: null`, `showLogout: false`, `csrfToken: ""`, and no flash read or consumed. `renderPage` takes an optional `{ minimal: true }` for this.
- 404 page: `ErrorPage` with `messages.notFound`. 403 page: `messages.forbidden` or `messages.csrfFailed`.
- Permission checks happen inside handlers through `can()` before any DB write or data read for that model.
