import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AdminUser } from "../types.js";

export interface Session {
  u: AdminUser | null;
  csrf: string;
  /** Issue time in unix seconds. */
  iat: number;
}
export const SESSION_COOKIE = "da_session";
export interface CookieOpts {
  secret: string;
  prefix: string;
  maxAgeSec: number;
  publicOrigin: string | null;
}

// Allowed clock skew for an `iat` that lies in the future.
const FUTURE_SKEW_SEC = 60;

/**
 * Decides the `Secure` flag. An explicit publicOrigin wins because behind a TLS-terminating
 * proxy the request URL is plain http while the browser talks https (decision 017).
 */
export function isSecure(c: Context, publicOrigin: string | null): boolean {
  return publicOrigin !== null
    ? publicOrigin.startsWith("https:")
    : new URL(c.req.url).protocol === "https:";
}

export function newCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newSession(user: AdminUser | null, now: number): Session {
  return { u: user, csrf: newCsrfToken(), iat: now };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSession(raw: string): Session | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const { u, csrf, iat } = data;
  if (typeof csrf !== "string" || csrf === "") return null;
  if (typeof iat !== "number" || !Number.isFinite(iat)) return null;
  if (u === null) return { u: null, csrf, iat };
  if (!isRecord(u) || typeof u.id !== "string" || typeof u.name !== "string") return null;
  return { u: { id: u.id, name: u.name }, csrf, iat };
}

export async function readSession(c: Context, o: CookieOpts, now: number): Promise<Session | null> {
  const raw = await getSignedCookie(c, o.secret, SESSION_COOKIE);
  if (typeof raw !== "string") return null;
  const session = parseSession(raw);
  if (session === null) return null;
  if (now - session.iat > o.maxAgeSec) return null;
  if (session.iat > now + FUTURE_SKEW_SEC) return null;
  return session;
}

export async function writeSession(c: Context, o: CookieOpts, s: Session): Promise<void> {
  // Explicit key list so extra properties on a caller's object never reach the cookie.
  const value = JSON.stringify({ u: s.u, csrf: s.csrf, iat: s.iat });
  await setSignedCookie(c, SESSION_COOKIE, value, o.secret, {
    httpOnly: true,
    sameSite: "Lax",
    path: o.prefix || "/",
    maxAge: o.maxAgeSec,
    secure: isSecure(c, o.publicOrigin),
  });
}

export function clearSession(c: Context, o: CookieOpts): void {
  deleteCookie(c, SESSION_COOKIE, { path: o.prefix || "/" });
}
