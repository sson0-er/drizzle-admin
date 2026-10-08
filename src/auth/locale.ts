import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../messages.js";
import { cookieAttrs } from "./session.js";

export const LOCALE_COOKIE = "da_lang";
export const LOCALE_MAX_AGE_SEC = 31536000;

/** The locale cookie is plain (not signed): it only selects a UI language, so a forged value does no harm. */
export function readLocale(c: Context): Locale {
  const v = getCookie(c, LOCALE_COOKIE);
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** Persistent, so the choice survives logout and a browser restart; attributes match the session cookies. */
export function writeLocale(
  c: Context,
  o: { prefix: string; publicOrigin: string | null },
  locale: Locale,
): void {
  setCookie(c, LOCALE_COOKIE, locale, {
    ...cookieAttrs(c, o.prefix, o.publicOrigin),
    maxAge: LOCALE_MAX_AGE_SEC,
  });
}
