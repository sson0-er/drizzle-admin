# Interface: routes (app assembly and middleware)

Files: `src/routes/index.ts` (`buildApp`), `src/routes/middleware.ts`, `src/routes/context.ts`.
Per-page behavior is in [routes-handlers.md](routes-handlers.md). Uses [auth.md](auth.md), [data.md](data.md), [forms.md](forms.md), [views.md](views.md), and `AdminState` from [admin.md](admin.md).

## Responsibilities
- Build the Hono app with relative routes, in the registration order that makes matching correct (decision 006).
- Apply security headers, Origin check, session, authentication, CSRF token check, and the error/404 handling.
- Provide a request-scoped context (`AdminVars`) to handlers.

## API
Changed 2026-10-07: `renderPage` takes `opts.minimal` for error pages rendered from `onError` (decision 022).

```ts
export function buildApp(state: AdminState): Hono<{ Variables: AdminVars }>;

// context.ts
export interface AdminVars {
  state: AdminState;
  repo: Repository;
  session: Session;          // always set after the session middleware (possibly anonymous)
  user: AdminUser | null;    // builtin: session.u; external: await getUser(c.req.raw)
  body: FormBody | null;     // parsed once by the csrfToken middleware for POST; null for GET
}
export function requireUser(c: Context): AdminUser;   // throws if null (guard guarantees non-null)
export function modelOr404(c: Context, slug: string): ResolvedModel | Response;
export async function renderPage(c: Context, status: 200 | 400 | 401 | 403 | 404 | 500, page: JSX.Element,
                                 opts?: { minimal?: boolean }): Promise<Response>;
  // consumes flash when status is 200 or 400 (the page needs it) and !opts.minimal,
  // returns c.html("<!DOCTYPE html>" + String(page), status). Callers build the PageChrome;
  // `minimal` (onError only, decision 022) skips every access to session/user/flash.
export async function redirectWithFlash(c: Context, location: string, msgs: FlashMessage[]): Promise<Response>;
  // addFlash then c.redirect(location, 303)
```
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

The catch-all compares `c.req.path` with `prefix`:
- `path === prefix + "/"` → dashboard (requires a logged-in user; no model permission).
- path does not end with `/` → `301` to `path + "/" + search`.
- otherwise → 404 page.
Any other method/path → route 11 → 404 page. A sub-app's `notFound` is not relied on: as a route, the fallback is included when the app is mounted with `app.route()` and in `admin.fetch` (decision 022; whether Hono ignores a mounted sub-app's `notFound` is unverified). An unmatched POST still passes the auth guard and the token check first, so without a valid token it is 403 (or a login redirect), and with a valid token it is 404.

Slugs `login`, `logout` and `static` are reserved (admin.md), so routes 2-3 never shadow a model.

Flash cookie options passed by `renderPage` / `redirectWithFlash`: `FlashOpts { secret, prefix, publicOrigin }` from `state.config`.
All `Location` headers built by routes and the catch-all are path-only (`${prefix}/...`), so they are correct behind a reverse proxy without using `publicOrigin`.

## Error handling
Changed 2026-10-07: `HTTPException` renders the layout error page; full logging for non-DB errors (decision 022).

- `app.onError(err)`:
  - `HTTPException` (from `hono/csrf`) → `ErrorPage` with `err.status`, message `messages.csrfFailed` for 403 and `messages.serverError` otherwise. Security headers are applied as for every response.
  - Anything else → log, then the 500 error page. Log `console.error("drizzle-admin:", describeForLog(err))` when `isDbError(err)` (data.md), because DB errors may carry SQL and bound parameters. Otherwise log `console.error("drizzle-admin:", err)` in full (message and stack), for example for bugs in formatters, `toString`, `validate` or `getUser`.
  - Pages rendered from `onError` must not assume that the middleware ran (the Origin check runs before the session). They use a minimal chrome: `user: null`, `showLogout: false`, `csrfToken: ""`, and no flash read or consumed. `renderPage` takes an optional `{ minimal: true }` for this.
- 404 page: `ErrorPage` with `messages.notFound`. 403 page: `messages.forbidden` or `messages.csrfFailed`.
- Permission checks happen inside handlers through `can()` before any DB write or data read for that model.
