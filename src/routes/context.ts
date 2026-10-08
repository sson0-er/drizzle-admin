import type { Context } from "hono";
import { type JSXNode, jsx } from "hono/jsx";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { addFlash, consumeFlash, type FlashMessage, type FlashOpts } from "../auth/flash.js";
import type { CookieOpts, Session } from "../auth/session.js";
import type { Repository } from "../data/repository.js";
import { messages } from "../messages.js";
import type { AdminState, AdminUser, FormBody, ResolvedModel } from "../types.js";
import { ErrorPage } from "../views/error.js";
import type { PageChrome } from "../views/layout.js";

export interface AdminVars {
  state: AdminState;
  repo: Repository;
  /** Always set after the session middleware (possibly anonymous). */
  session: Session;
  /** Builtin: `session.u`; external: `await getUser(c.req.raw)`. */
  user: AdminUser | null;
  /** Parsed once by the csrfToken middleware for POST; null otherwise. */
  body: FormBody | null;
}

export type AdminEnv = { Variables: AdminVars };
export type AdminContext = Context<AdminEnv>;

export const cookieOpts = ({ config }: AdminState): CookieOpts => ({
  secret: config.secret,
  prefix: config.prefix,
  maxAgeSec: config.sessionMaxAgeSec,
  publicOrigin: config.publicOrigin,
});

export const flashOpts = ({ config }: AdminState): FlashOpts => ({
  secret: config.secret,
  prefix: config.prefix,
  publicOrigin: config.publicOrigin,
});

/** Guard-protected handlers call this; a null user here is a bug in the middleware order. */
export function requireUser(c: AdminContext): AdminUser {
  const user = c.var.user;
  if (user === null) throw new Error("drizzle-admin: no authenticated user");
  return user;
}

/** Chrome for pages rendered inside the middleware chain; `trail` follows the Home crumb. */
export function pageChrome(
  c: AdminContext,
  title: string,
  trail: PageChrome["breadcrumbs"] = [],
  flash: FlashMessage[] = [],
): PageChrome {
  const { state, session, user } = c.var;
  const { prefix, siteTitle } = state.config;
  return {
    siteTitle,
    prefix,
    title,
    user,
    // Logout exists only with the builtin login.
    showLogout: state.config.authMode === "builtin" && user !== null,
    csrfToken: session.csrf,
    flash,
    breadcrumbs: [{ label: messages.home, href: `${prefix}/` }, ...trail],
  };
}

/**
 * Error page that assumes nothing about the middleware chain: the Origin check runs before the
 * session, so an error raised there has no session, user or flash (decision 022).
 */
function minimalChrome(state: AdminState, title: string): PageChrome {
  const { prefix, siteTitle } = state.config;
  return {
    siteTitle,
    prefix,
    title,
    user: null,
    showLogout: false,
    csrfToken: "",
    flash: [],
    breadcrumbs: [{ label: messages.home, href: `${prefix}/` }],
  };
}

const html = (c: AdminContext, status: ContentfulStatusCode, page: JSXNode): Response =>
  c.html(`<!DOCTYPE html>${String(page)}`, status);

/** Synchronous error page; never consumes flash. `minimal` skips session and user access. */
export function errorPage(
  c: AdminContext,
  status: ContentfulStatusCode,
  message: string,
  opts?: { minimal?: boolean },
): Response {
  const title = String(status);
  const chrome = opts?.minimal ? minimalChrome(c.var.state, title) : pageChrome(c, title);
  return html(c, status, jsx(ErrorPage, { ...chrome, status, message }));
}

/** The model's `ordering`, or primary key descending when it has none (decision 013 item 4). */
export function defaultOrdering(model: ResolvedModel): ResolvedModel["ordering"] {
  return model.ordering.length > 0 ? model.ordering : [{ key: model.meta.pk.key, desc: true }];
}

export function modelOr404(c: AdminContext, slug: string): ResolvedModel | Response {
  return c.var.state.models.get(slug) ?? errorPage(c, 404, messages.notFound);
}

/**
 * `page` is a ready element, or a function that receives the consumed flash messages. Flash is
 * consumed only for 200 / 400 pages that are not `minimal` (the page needs it); use the function
 * form there so the messages reach the chrome.
 */
export async function renderPage(
  c: AdminContext,
  status: 200 | 400 | 401 | 403 | 404 | 500,
  page: JSXNode | ((flash: FlashMessage[]) => JSXNode),
  opts?: { minimal?: boolean },
): Promise<Response> {
  const wantsFlash = (status === 200 || status === 400) && !opts?.minimal;
  const flash = wantsFlash ? await consumeFlash(c, flashOpts(c.var.state)) : [];
  return html(c, status, typeof page === "function" ? page(flash) : page);
}

export async function redirectWithFlash(
  c: AdminContext,
  location: string,
  msgs: FlashMessage[],
): Promise<Response> {
  await addFlash(c, flashOpts(c.var.state), msgs);
  return c.redirect(location, 303);
}
