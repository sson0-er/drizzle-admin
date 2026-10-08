import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { cookieAttrs } from "./session.js";

// Flash message types shared with the views.
export type FlashLevel = "success" | "warning" | "error";
export interface FlashMessage {
  level: FlashLevel;
  text: string;
}
export const FLASH_COOKIE = "da_flash";
export interface FlashOpts {
  secret: string;
  prefix: string;
  publicOrigin: string | null;
}

const FLASH_MAX_AGE_SEC = 60;
const LEVELS: readonly string[] = ["success", "warning", "error"];

// Messages already queued on this response; a second Set-Cookie would otherwise replace them.
const pending = new WeakMap<Context, FlashMessage[]>();

function isFlashMessage(v: unknown): v is FlashMessage {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return typeof m.level === "string" && LEVELS.includes(m.level) && typeof m.text === "string";
}

export async function addFlash(c: Context, o: FlashOpts, msgs: FlashMessage[]): Promise<void> {
  const all = [...(pending.get(c) ?? []), ...msgs.map(({ level, text }) => ({ level, text }))];
  pending.set(c, all);
  await setSignedCookie(c, FLASH_COOKIE, JSON.stringify(all), o.secret, {
    ...cookieAttrs(c, o.prefix, o.publicOrigin),
    maxAge: FLASH_MAX_AGE_SEC,
  });
}

export async function consumeFlash(c: Context, o: FlashOpts): Promise<FlashMessage[]> {
  const raw = await getSignedCookie(c, o.secret, FLASH_COOKIE);
  if (raw === undefined) return [];
  // Delete whenever a cookie was present, so a bad one cannot linger.
  deleteCookie(c, FLASH_COOKIE, cookieAttrs(c, o.prefix, o.publicOrigin));
  if (raw === false) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data) || !data.every(isFlashMessage)) return [];
  return data.map(({ level, text }) => ({ level, text }));
}
