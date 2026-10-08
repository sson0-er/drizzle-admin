import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { originCheck } from "../auth/csrf.js";
import { describeForLog, isDbError } from "../data/errors.js";
import { createRepository } from "../data/repository.js";
import { messages } from "../messages.js";
import { ADMIN_CSS } from "../static/admin-css.js";
import type { AdminState } from "../types.js";
import { type AdminContext, type AdminEnv, errorPage } from "./context.js";
import { dashboardHandler } from "./dashboard.js";
import { addHandler, changeHandler } from "./form.js";
import { listHandler } from "./list.js";
import {
  csrfToken,
  initVars,
  securityHeaders,
  sessionMiddleware,
  userMiddleware,
} from "./middleware.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is excluded
const SAFE_REST = /^(?:\/[^/\\\s\x00-\x1f\x7f]+)+$/;

const notFound = (c: AdminContext): Response => errorPage(c, 404, messages.notFound);

/** Route 10: the dashboard, the trailing-slash redirect, or 404. */
function catchAll(prefix: string) {
  return (c: AdminContext): Promise<Response> | Response => {
    const path = c.req.path;
    if (path === `${prefix}/`) return dashboardHandler(c);
    // Allowlist: the part after the prefix is empty (the bare prefix) or one or more "/segment"
    // pieces. A segment has no slash, backslash, whitespace or control character, so the Location
    // can never read as a protocol-relative URL, even after a browser strips tabs and newlines
    // (hono percent-decodes the path, so "%09" arrives as a literal tab). Anything else is a 404.
    const rest = path.slice(prefix.length);
    if (rest === "" || SAFE_REST.test(rest)) {
      return c.redirect(`${path}/${new URL(c.req.url).search}`, 301);
    }
    return notFound(c);
  };
}

export function buildApp(state: AdminState): Hono {
  const { config } = state;
  const repo = createRepository({
    db: config.db,
    dialect: config.dialect,
    timeZone: config.timeZone,
  });
  const app = new Hono<AdminEnv>();

  app.use("*", initVars(state, repo));
  // 1. securityHeaders
  app.use("*", securityHeaders);
  // 2. static (route 1): registered before the remaining middleware so none of it runs for the CSS.
  app.get("/static/admin.css", (c) =>
    c.body(ADMIN_CSS, 200, {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    }),
  );
  // 3-5, 7. originCheck, session, user, csrfToken (the authGuard goes before csrfToken in task 23).
  app.use("*", originCheck(config.publicOrigin));
  app.use("*", sessionMiddleware(state));
  app.use("*", userMiddleware(state));
  app.use("*", csrfToken);

  // Routes 2-9 (login, logout, list, action, add, change, delete) are registered here, in table
  // order, by tasks 15, 19, 20, 21 and 23. They must stay above the catch-all.
  app.get("/:model/", listHandler); // route 4
  app.on(["GET", "POST"], "/:model/add/", addHandler); // route 6
  app.on(["GET", "POST"], "/:model/:pk/change/", changeHandler); // routes 7 and 8

  app.get("/*", catchAll(config.prefix));
  app.all("/*", notFound);

  app.onError((err, c) => {
    // Minimal pages: the error may predate the session and user middleware (decision 022).
    if (err instanceof HTTPException) {
      const message = err.status === 403 ? messages.csrfFailed : messages.serverError;
      return errorPage(c, err.status, message, { minimal: true });
    }
    // DB errors can carry SQL and bound parameters, so only their classification is logged.
    console.error("drizzle-admin:", isDbError(err) ? describeForLog(err) : err);
    return errorPage(c, 500, messages.serverError, { minimal: true });
  });

  // `Admin.app` is a plain `Hono`; the variables are internal to this app, so widen on the way out.
  return app as unknown as Hono;
}
