# 050: The chosen locale is an unsigned `da_lang` cookie, validated against the allow-list on read

- Date: 2026-10-09
- Status: accepted

## Context
User decision (2026-10-09): the locale is kept only in the browser, as a cookie; no DB and no session storage; no `Accept-Language` negotiation, so a visitor without the cookie gets English. The cookie must use the shared `cookieAttrs` / `isSecure` rules with `Path` = prefix and be validated against the allow-list on read. Open for the designer: name, lifetime, and whether to sign it.

## Decision
1. New module `src/auth/locale.ts` (next to the other cookie code, so every user of `cookieAttrs` stays in one component):
   ```ts
   export const LOCALE_COOKIE = "da_lang";
   export const LOCALE_MAX_AGE_SEC = 31536000;   // 365 days
   export function readLocale(c: Context): Locale;
   export function writeLocale(c: Context, o: { prefix: string; publicOrigin: string | null }, locale: Locale): void;
   ```
2. `readLocale`: `v = getCookie(c, LOCALE_COOKIE)`; returns `v` when `isLocale(v)` (exact, case-sensitive match against `LOCALES`), else `DEFAULT_LOCALE` (`"en"`). A missing, empty or unknown value (`fr`, `JA`, `ja `) gives English. An invalid cookie is neither rewritten nor deleted.
3. `writeLocale`: `setCookie(c, LOCALE_COOKIE, locale, { ...cookieAttrs(c, o.prefix, o.publicOrigin), maxAge: LOCALE_MAX_AGE_SEC })`, i.e. `Path=<prefix or />`, `HttpOnly`, `SameSite=Lax`, `Secure` exactly when `isSecure`, `Max-Age=31536000`. Only the switch handler (decision 051) calls it.
4. The value is not signed.
5. The cookie is never deleted by the admin. Logout clears only `da_session`, so the language survives logout and login.
6. The request's `Accept-Language` header is never read.

## Alternatives considered
- Sign with a key derived like decision 042: the value is a public preference, not a secret or a capability; validation on read already limits any forged value to `en` or `ja`, which the user could pick anyway. Signing would also tie the cookie to the derived keys, which exist only after the session middleware, so the Origin-check 403 and `onError` pages could not be localized, and rotating `secret` would reset everyone's language.
- A session cookie (no `Max-Age`): the preference would be lost when the browser closes.
- Lifetime equal to `sessionMaxAgeSec`: unrelated to the login lifetime; a short session would keep resetting the language.
- `HttpOnly` off: no script reads it (the only script is the select-all toggle), and `cookieAttrs` is the shared rule.
- A `__Host-` name prefix: it requires `Path=/`, which conflicts with `Path` = prefix.

## Rationale
hono's `getCookie` returns `undefined` for a missing cookie, never throws on malformed escapes and takes the first occurrence of a name (evidence: 2026-10-09-hono-plain-cookie-read), so `readLocale` is safe to call in `initVars` before any other middleware. 365 days is below the serializer's 400-day `maxAge` limit (evidence: 2026-10-08-hono-signed-cookie-key-and-max-age; evidence: 2026-10-09-hono-plain-cookie-read). Pages are already `Cache-Control: no-store` (routes.md), so a response that varies by the cookie is never cached and no `Vary` header is needed.

## Consequences
- auth.md (`locale.ts`), routes.md (`initVars`), test-strategy.md (cookie attribute and validation cases).
- Instances that share a prefix path (replicas) share the language, like the session; instances with different prefixes keep separate languages.
- A cookie set for one prefix is not sent to another, so each admin instance on the same host has its own language choice.
