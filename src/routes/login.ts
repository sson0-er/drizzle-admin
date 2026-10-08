import { jsx } from "hono/jsx";
import { safeNext } from "../auth/redirect.js";
import { clearSession, newSession, writeSession } from "../auth/session.js";
import { messages } from "../messages.js";
import { LoginPage } from "../views/login.js";
import { type AdminContext, cookieOpts, pageChrome, renderPage } from "./context.js";

const asString = (v: unknown): string => (typeof v === "string" ? v : "");

/** `GET|POST ${prefix}/login/` (builtin mode only; the route is not registered otherwise). */
export async function loginHandler(c: AdminContext): Promise<Response> {
  const { state, user } = c.var;
  const { prefix, auth } = state.config;

  if (c.req.method !== "POST") {
    const next = c.req.query("next");
    if (user !== null) return c.redirect(safeNext(next, prefix), 302);
    return renderLogin(c, { next: next ?? "", username: "" });
  }

  const body = c.var.body ?? {};
  const username = asString(body.username);
  const password = asString(body.password);
  const next = asString(body.next);
  // `verifyCredentials` is guaranteed in builtin mode (createAdmin rejects a config without it).
  const verified = await auth.verifyCredentials?.(username, password);
  if (verified == null) return renderLogin(c, { next, username, error: messages.loginFailed });

  // A fresh session (new CSRF token) on every login, so a pre-login token cannot be reused.
  await writeSession(
    c,
    cookieOpts(c),
    newSession({ id: verified.id, name: verified.name }, Math.floor(Date.now() / 1000)),
  );
  return c.redirect(safeNext(next, prefix), 303);
}

function renderLogin(
  c: AdminContext,
  props: { next: string; username: string; error?: string },
): Promise<Response> {
  const { prefix } = c.var.state.config;
  // The hidden field is rendered back into the page, so it only ever carries a vetted target.
  const next = props.next === "" ? "" : safeNext(props.next, prefix);
  return renderPage(c, props.error === undefined ? 200 : 400, (flash) =>
    jsx(LoginPage, {
      ...pageChrome(c, messages.login, [], flash),
      ...props,
      next,
    }),
  );
}

/** `POST ${prefix}/logout/` (builtin mode only). */
export function logoutHandler(c: AdminContext): Response {
  const { state } = c.var;
  clearSession(c, cookieOpts(c));
  return c.redirect(`${state.config.prefix}/login/`, 303);
}
