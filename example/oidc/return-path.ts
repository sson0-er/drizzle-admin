// Mirrors `safeNext` in src/auth/redirect.ts (decisions 029 and 032) and must be kept in step with
// it. The library keeps that function internal, so the example carries its own copy instead of
// importing from src/auth/.
const PLACEHOLDER_ORIGIN = "http://x.invalid";

function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validates the `next` parameter of the login route: @hono/oidc-auth returns to the URL in its
 * `continue` cookie without checking it, so only a single-slash path under `prefix` survives.
 */
export function safeReturnPath(next: string | undefined, prefix: string): string {
  const fallback = `${prefix}/`;
  if (!next?.startsWith("/") || next[1] === "/") return fallback;
  // Browsers drop tab/LF/CR and treat a backslash like a slash, so these are refused, not normalized.
  if (hasControlChar(next) || /[\s\\]/.test(next)) return fallback;

  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN || !url.pathname.startsWith(`${prefix}/`)) {
    return fallback;
  }
  if (url.pathname.includes("//")) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return fallback;
  }
  if (hasControlChar(decoded) || decoded.includes("\\")) return fallback;
  if (decoded.split("/").some((segment) => segment === "." || segment === "..")) return fallback;

  return url.pathname + url.search;
}
