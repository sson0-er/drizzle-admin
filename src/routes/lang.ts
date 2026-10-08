import { writeLocale } from "../auth/locale.js";
import { safeNext } from "../auth/redirect.js";
import { isLocale } from "../messages.js";
import type { AdminContext } from "./context.js";

/**
 * `POST ${prefix}/_lang/` (both auth modes). Runs after the Origin and token checks, and the auth
 * guard exempts it, so the user may be null. The redirect does not depend on whether `lang` was valid.
 */
export function langHandler(c: AdminContext): Response {
  const { state, body } = c.var;
  const { prefix, publicOrigin } = state.config;
  const { lang, next } = body ?? {};
  if (isLocale(lang)) writeLocale(c, { prefix, publicOrigin }, lang);
  return c.redirect(safeNext(typeof next === "string" ? next : undefined, prefix), 303);
}
