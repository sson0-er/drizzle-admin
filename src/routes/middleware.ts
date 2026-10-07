import type { MiddlewareHandler } from "hono";
import { CSRF_FIELD, tokensEqual } from "../auth/csrf.js";
import { newSession, readSession, writeSession } from "../auth/session.js";
import type { Repository } from "../data/repository.js";
import { messages } from "../messages.js";
import type { AdminState, AdminUser } from "../types.js";
import { type AdminEnv, cookieOpts, errorPage } from "./context.js";

type Mw = MiddlewareHandler<AdminEnv>;

// TEMPORARY, removed in task 23: there is no login before the auth guard exists, but handlers need
// a non-null user for `can()` and `HookCtx`. Builtin mode falls back to this user.
export const PRE_AUTH_USER: AdminUser = { id: "pre-auth", name: "pre-auth" };

/** Runs first so that every later middleware, handler and `onError` can read `state` and `repo`. */
export const initVars =
  (state: AdminState, repo: Repository): Mw =>
  async (c, next) => {
    c.set("state", state);
    c.set("repo", repo);
    c.set("body", null);
    await next();
  };

export const securityHeaders: Mw = async (c, next) => {
  await next();
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "same-origin");
  // Only the static CSS route sets its own Cache-Control.
  if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
};

export const sessionMiddleware =
  (state: AdminState): Mw =>
  async (c, next) => {
    const opts = cookieOpts(state);
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
    if (authMode === "external" && auth.getUser !== undefined) {
      c.set("user", await auth.getUser(c.req.raw));
    } else {
      c.set("user", c.var.session.u ?? PRE_AUTH_USER);
    }
    await next();
  };

/** POST only: parses the body once for the handlers and requires the session's CSRF token. */
export const csrfToken: Mw = async (c, next) => {
  if (c.req.method === "POST") {
    const body = await c.req.parseBody({ all: true });
    c.set("body", body);
    const token = body[CSRF_FIELD];
    if (typeof token !== "string" || !tokensEqual(token, c.var.session.csrf)) {
      return errorPage(c, 403, messages.csrfFailed);
    }
  }
  await next();
};
