const PLACEHOLDER_ORIGIN = "http://x.invalid";

function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Allowlist for post-login targets (decision 029): only a single-slash path under `prefix`
 * survives, everything else falls back to the dashboard. Browsers drop tab/LF/CR and treat
 * `\` like `/` when parsing a URL, so these are refused rather than normalized.
 *
 * Rules, on top of the same-origin and prefix checks:
 * - raw `next`: no control character, whitespace or backslash, and it must not start with `//`;
 * - percent-decoded path (what a router or proxy may see): no control character or
 *   backslash, no `.` or `..` segment (so a decoded `..%2F` cannot step out of the prefix),
 *   and valid escapes. Decoded whitespace and `%2F` are fine: they stay encoded in the
 *   returned Location.
 * - URL-normalized path: `//` anywhere in it is rejected.
 * The query string is not inspected beyond the raw checks; it cannot change the target.
 */
export function safeNext(next: string | undefined | null, prefix: string): string {
  const fallback = `${prefix}/`;
  if (!next?.startsWith("/") || next[1] === "/") return fallback;
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

export function loginRedirectUrl(prefix: string, currentPathAndQuery: string): string {
  return `${prefix}/login/?next=${encodeURIComponent(currentPathAndQuery)}`;
}

export function externalLoginUrl(loginUrl: string, currentPathAndQuery: string): string {
  const separator = loginUrl.includes("?") ? "&" : "?";
  return `${loginUrl}${separator}next=${encodeURIComponent(currentPathAndQuery)}`;
}
