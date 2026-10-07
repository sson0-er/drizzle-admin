import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";

export const CSRF_FIELD = "_csrf";

// With a public origin configured, requests behind a reverse proxy carry the
// public Origin, not the internal request URL origin, so pin it explicitly.
// secFetchSite stays at its default; hono passes if either check passes.
export function originCheck(publicOrigin: string | null): MiddlewareHandler {
  return publicOrigin === null ? csrf() : csrf({ origin: publicOrigin });
}

// Constant time over the full length; only the length may leak.
export function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
