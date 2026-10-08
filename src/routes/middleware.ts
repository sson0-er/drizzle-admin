import type { MiddlewareHandler } from "hono";
import { CSRF_FIELD, tokensEqual } from "../auth/csrf.js";
import { readLocale } from "../auth/locale.js";
import { externalLoginUrl, loginRedirectUrl, safeNext } from "../auth/redirect.js";
import { newSession, readSession, writeSession } from "../auth/session.js";
import type { Repository } from "../data/repository.js";
import { MESSAGES } from "../messages.js";
import { SELECT_ALL_SCRIPT_SHA256 } from "../static/select-all.js";
import type { AdminState } from "../types.js";
import { type AdminEnv, type AdminVars, cookieOpts, errorPage } from "./context.js";

type Mw = MiddlewareHandler<AdminEnv>;

/** Runs first so that every later middleware, handler and `onError` can read `state` and `repo`. */
export const initVars =
  (state: AdminState, repo: Repository): Mw =>
  async (c, next) => {
    c.set("state", state);
    c.set("repo", repo);
    c.set("body", null);
    const locale = readLocale(c);
    c.set("locale", locale);
    c.set("t", MESSAGES[locale]);
    await next();
  };

/**
 * The policy depends only on the auth mode. `form-action` is left out in external mode: a form
 * submitted after the host session expired is redirected to the host's login URL, which may be
 * cross-origin and chain through further hops (decision 044).
 */
export const buildCsp = (authMode: "builtin" | "external"): string =>
  [
    "default-src 'none'",
    `script-src 'sha256-${SELECT_ALL_SCRIPT_SHA256}'`,
    "style-src 'self'",
    ...(authMode === "builtin" ? ["form-action 'self'"] : []),
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; ");

export const securityHeaders =
  (csp: string): Mw =>
  async (c, next) => {
    await next();
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Content-Security-Policy", csp);
    // Only the static CSS route sets its own Cache-Control.
    if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
  };

export const sessionMiddleware =
  (_state: AdminState, getCookieKeys: () => Promise<AdminVars["cookieKeys"]>): Mw =>
  async (c, next) => {
    c.set("cookieKeys", await getCookieKeys());
    const opts = cookieOpts(c);
    const now = Math.floor(Date.now() / 1000);
    let session = await readSession(c, opts, now);
    if (session === null) {
      session = newSession(null, now);
      // Only GET/HEAD issue a cookie. Any other method keeps a transient session whose token
      // cannot match, so the token check fails with 403.
      if (c.req.method === "GET" || c.req.method === "HEAD") await writeSession(c, opts, session);
    }
    c.set("session", session);
    await next();
  };

export const userMiddleware =
  (state: AdminState): Mw =>
  async (c, next) => {
    const { authMode, auth } = state.config;
    // External mode ignores `session.u` (it is always null there); the host decides per request.
    c.set(
      "user",
      authMode === "builtin" ? c.var.session.u : ((await auth.getUser?.(c.req.raw)) ?? null),
    );
    await next();
  };

/**
 * Sends anonymous requests to login (or answers 401 for an external setup without a login URL).
 * Runs before the token check, so a logged-out form post goes to login instead of getting 403.
 */
export const authGuard: Mw = async (c, next) => {
  if (c.var.user !== null) return next();
  const { authMode, auth, prefix } = c.var.state.config;
  const { method } = c.req;

  // The login page itself must be reachable while logged out. `c.req.path` is enough here: it is
  // only compared with a fixed, encoding-free path.
  const isLogin = c.req.path === `${prefix}/login/`;
  if (
    authMode === "builtin" &&
    isLogin &&
    (method === "GET" || method === "HEAD" || method === "POST")
  ) {
    return next();
  }

  // The language switch needs no login, in either auth mode; only POST is exempt.
  if (method === "POST" && c.req.path === `${prefix}/_lang/`) return next();

  // The raw pathname keeps percent-escapes (`c.req.path` decodes them, and `safeNext` rejects a
  // decoded space), so the target survives the login round trip (decision 032).
  const url = new URL(c.req.url);
  const target = url.pathname + url.search;
  if (authMode === "builtin") {
    // A form post cannot be replayed through a redirect, so the dashboard is the landing page.
    const replayable = method === "GET" || method === "HEAD";
    return c.redirect(loginRedirectUrl(prefix, replayable ? target : `${prefix}/`), 302);
  }
  if (auth.loginUrl !== undefined) {
    return c.redirect(externalLoginUrl(auth.loginUrl, safeNext(target, prefix)), 302);
  }
  return errorPage(c, 401, c.var.t.unauthorized);
};

/** POST only: parses the body once for the handlers and requires the session's CSRF token. */
export const csrfToken: Mw = async (c, next) => {
  if (c.req.method === "POST") {
    const body = await c.req.parseBody({ all: true });
    c.set("body", body);
    const token = body[CSRF_FIELD];
    if (typeof token !== "string" || !tokensEqual(token, c.var.session.csrf)) {
      return errorPage(c, 403, c.var.t.csrfFailed);
    }
  }
  await next();
};
