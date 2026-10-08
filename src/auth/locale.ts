import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { DEFAULT_LOCALE, isLocale, type Locale } from "../messages.js";

export const LOCALE_COOKIE = "da_lang";

/** The locale cookie is plain (not signed): it only selects a UI language, so a forged value does no harm. */
export function readLocale(c: Context): Locale {
  const v = getCookie(c, LOCALE_COOKIE);
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
