import type { MiddlewareHandler } from "hono";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const WILDCARD = new Set(["0.0.0.0", "[::]"]);
const IPV4_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * DNS-rebinding protection for the demo: the Host header (as seen in the request URL) must name
 * the bound host and port. Loopback names are accepted for loopback and wildcard binds, and IP
 * literals for wildcard binds, because rebinding needs an attacker-controlled name.
 */
export function isAllowedHost(requestUrl: string, bindHost: string, port: number): boolean {
  const u = new URL(requestUrl);
  const h = u.hostname;
  const effectivePort = u.port === "" ? (u.protocol === "https:" ? 443 : 80) : Number(u.port);
  if (effectivePort !== port) return false;
  const lower = bindHost.toLowerCase();
  const b = lower.includes(":") ? `[${lower}]` : lower;
  if (h === b) return true;
  if ((LOOPBACK.has(b) || WILDCARD.has(b)) && LOOPBACK.has(h)) return true;
  return WILDCARD.has(b) && (IPV4_LITERAL.test(h) || h.startsWith("["));
}

export function hostGuard(bindHost: string, port: number): MiddlewareHandler {
  return async (c, next) => {
    if (!isAllowedHost(c.req.url, bindHost, port)) {
      return c.text("Forbidden: unexpected Host header", 403);
    }
    await next();
  };
}
