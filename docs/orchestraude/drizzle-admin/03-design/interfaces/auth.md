# Interface: auth

Files: `src/auth/session.ts`, `src/auth/csrf.ts`, `src/auth/flash.ts`, `src/auth/redirect.ts`, `src/auth/permissions.ts`, `src/auth/locale.ts` (Changed 2026-10-09, decision 050).
Uses `hono/cookie` (`getSignedCookie`, `setSignedCookie`, `deleteCookie`; `getCookie`, `setCookie` for `da_lang`) and `hono/csrf`. Web Crypto only (`crypto.getRandomValues`, and `crypto.subtle` HMAC for `deriveCookieKey`). No `node:` imports.

## Responsibilities
- Signed session cookie (§10) carrying user, CSRF token and issue time.
- CSRF: Origin/Sec-Fetch-Site check (`hono/csrf`) plus a constant-time hidden-token check.
- Flash messages across one redirect.
- Safe `next` handling and login redirect URLs.
- Permission evaluation.
- The locale cookie `da_lang` (Changed 2026-10-09, decision 050): it is a preference, not an auth artifact, but it lives here so that every user of `cookieAttrs` stays in one component.

## API

### `session.ts` (decisions 008, 014, 017)
Changed 2026-10-07: `CookieOpts` gained `publicOrigin` and `isSecure()` decides the `Secure` flag (decision 017); external-mode use fixed (decision 014).
Changed 2026-10-08: `clearSession` deletes with the same attributes as `writeSession`, including `Secure` (decision 036).
Changed 2026-10-08: exported helper `cookieAttrs` recorded (added by task 30); all session and flash cookie sets and deletes use it, with `maxAge` added only on sets (decision 036, L072).
Changed 2026-10-08: cookies are signed with keys derived per instance and per cookie (`deriveCookieKey`); `CookieOpts.secret` is replaced by `key` (decision 042).
```ts
export interface Session { u: AdminUser | null; csrf: string; iat: number } // iat = unix seconds
export const SESSION_COOKIE = "da_session";
export interface CookieOpts { key: ArrayBuffer; prefix: string; maxAgeSec: number; publicOrigin: string | null }
  // key = deriveCookieKey(secret, SESSION_COOKIE, prefix), derived once per app (routes.md)
export async function deriveCookieKey(secret: string, cookieName: string, prefix: string): Promise<ArrayBuffer>;
  // HMAC-SHA256 with key UTF-8(secret) over UTF-8(`${cookieName}\0${prefix}`): 32 bytes (decision 042)
export async function readSession(c: Context, o: CookieOpts, now: number): Promise<Session | null>;
export async function writeSession(c: Context, o: CookieOpts, s: Session): Promise<void>;
export function clearSession(c: Context, o: CookieOpts): void;
export function newSession(user: AdminUser | null, now: number): Session; // fresh random csrf
export function newCsrfToken(): string;   // 32 random bytes, base64url (43 chars)
export function isSecure(c: Context, publicOrigin: string | null): boolean;
  // publicOrigin !== null ? publicOrigin.startsWith("https:") : new URL(c.req.url).protocol === "https:"
export function cookieAttrs(c: Context, prefix: string, publicOrigin: string | null):
  { readonly httpOnly: true; readonly sameSite: "Lax"; readonly path: string; readonly secure: boolean };
  // { httpOnly: true, sameSite: "Lax", path: prefix || "/", secure: isSecure(c, publicOrigin) } as const
```
- `cookieAttrs` is the single source of the attributes shared by every set and delete of `da_session`, `da_flash` and (Changed 2026-10-09, decision 050) `da_lang` (`writeSession`, `clearSession`, `addFlash`, `consumeFlash`, `writeLocale`). Deletions must carry the same attributes as sets (decision 036), so these call sites must not build attributes themselves. Sets spread it and add `maxAge`; deletes pass it unchanged (decision 036, L072).
- `deriveCookieKey` uses Web Crypto only: `crypto.subtle.importKey("raw", UTF-8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])`, then `crypto.subtle.sign("HMAC", key, UTF-8(cookieName + "\0" + prefix))`. `prefix` is the normalized prefix (`""` for basePath `"/"`). The result is passed unchanged as the `secret` argument of hono's `getSignedCookie` / `setSignedCookie`, which accept a `BufferSource` and import it as a raw HMAC key (evidence: 2026-10-08-hono-signed-cookie-key-and-max-age). Consequences (decision 042): instances with different prefixes reject each other's cookies even with the same `secret`; a `da_session` value never verifies as `da_flash` and the reverse; instances with the same `secret` and prefix (replicas) share sessions.
- `readSession` returns `null` if the cookie is missing, the signature is invalid (`getSignedCookie` → `false`), the JSON is malformed or has the wrong shape (validate: `u` null or `{id: string, name: string}`, `csrf` non-empty string, `iat` finite number), or `now - iat > maxAgeSec` or `iat > now + 60`.
- `writeSession` cookie attributes: `{ ...cookieAttrs(c, o.prefix, o.publicOrigin), maxAge: o.maxAgeSec }`, i.e. `httpOnly: true`, `sameSite: "Lax"`, `path: prefix || "/"`, `maxAge: maxAgeSec`, `secure: isSecure(c, o.publicOrigin)`.
- External-auth mode (decision 014): the same cookie is used with `u` always `null`; it only carries `csrf` and `iat`. Callers never pass a user to `newSession` in external mode, and the user comes from `getUser` (routes.md).
- `clearSession` deletes with `deleteCookie(c, SESSION_COOKIE, cookieAttrs(c, o.prefix, o.publicOrigin))`: the same attributes as `writeSession`; `deleteCookie` adds `Max-Age=0` and passes every option through (evidence: 2026-10-08-hono-head-cookie-body-node-server). So under an https `publicOrigin` (or an https request URL without `publicOrigin`) the deletion carries `Secure` too (decision 036).

### `csrf.ts`
Changed 2026-10-07: `originCheck` takes `publicOrigin` (decision 017). Exact-match behaviour must be proven by tests, otherwise the task is blocked (decision 020).
```ts
export const CSRF_FIELD = "_csrf";
export function originCheck(publicOrigin: string | null): MiddlewareHandler;
  // publicOrigin === null → csrf()  (default: Origin must equal the request URL origin)
  // otherwise             → csrf({ origin: publicOrigin })  (intended: exact match; unverified, see below)
  // secFetchSite stays at its default ("same-origin"); hono/csrf passes if either check passes
export function tokensEqual(a: string, b: string): boolean; // constant time
```
See evidence 2026-10-07-hono-csrf-origin-option for the `origin` option and the OR combination with Sec-Fetch-Site.
Whether hono compares the string `origin` option by exact equality is unverified (evidence: 2026-10-07-hono-csrf-origin-option). By user decision (decision 020), `csrf.test.ts` must prove it. With `publicOrigin = "https://admin.example.com"`, a form POST without `Sec-Fetch-Site` passes with Origin `https://admin.example.com`. It gets 403 with each of `https://admin.example.com:8443`, `https://admin.example.com/`, `https://admin.example.com.evil.example` and `http://admin.example.com`. If any case behaves differently, the implementer reports the task as blocked and does not change `originCheck` without a new decision.
`tokensEqual`: returns false if the lengths differ; otherwise XOR-accumulates all char codes over the full length. No early exit.

### `flash.ts`
Changed 2026-10-07: options gained `publicOrigin` for the `Secure` flag (decision 017).
Changed 2026-10-08: several `da_flash` Set-Cookie headers per response are acceptable (decision 033 item 1); `consumeFlash` deletes with the same attributes as `addFlash`, including `Secure` (decision 036).
Changed 2026-10-08: `addFlash` and `consumeFlash` take their attributes from `cookieAttrs` imported from `session.ts` (task 30; decision 036, L072).
Changed 2026-10-08: `FlashOpts.secret` is replaced by `key`, the derived flash key (decision 042).
```ts
export type FlashLevel = "success" | "warning" | "error";
export interface FlashMessage { level: FlashLevel; text: string }
export const FLASH_COOKIE = "da_flash";
export interface FlashOpts { key: ArrayBuffer; prefix: string; publicOrigin: string | null }
  // key = deriveCookieKey(secret, FLASH_COOKIE, prefix) (session.ts, decision 042)
export async function addFlash(c: Context, o: FlashOpts, msgs: FlashMessage[]): Promise<void>;
export async function consumeFlash(c: Context, o: FlashOpts): Promise<FlashMessage[]>;
```
Signed cookie, `{ ...cookieAttrs(c, o.prefix, o.publicOrigin), maxAge: 60 }` (`import { cookieAttrs } from "./session.js"`), i.e. `httpOnly`, `sameSite: "Lax"`, `path: prefix || "/"`, `maxAge: 60`, `secure: isSecure(c, o.publicOrigin)` (as for the session). `addFlash` appends to messages already set in this response: each call emits one more `da_flash` Set-Cookie holding all messages queued so far in this response, so when it is called more than once the response carries several headers and the last one is complete (browsers keep the last; unverified). A single header is not required (decision 033 item 1). `consumeFlash` reads, validates the shape (invalid → `[]`) and, whenever a cookie was present, deletes it with `deleteCookie(c, FLASH_COOKIE, cookieAttrs(c, o.prefix, o.publicOrigin))`, the same attributes as `addFlash` except `maxAge` (`httpOnly`, `sameSite: "Lax"`, `path`, `secure: isSecure(c, o.publicOrigin)`; decision 036). Only pages rendered with 200/400 consume flash; redirects do not.

### `redirect.ts`
```ts
export function safeNext(next: string | undefined | null, prefix: string): string;
export function loginRedirectUrl(prefix: string, currentPathAndQuery: string): string;
  // `${prefix}/login/?next=${encodeURIComponent(currentPathAndQuery)}`
export function externalLoginUrl(loginUrl: string, currentPathAndQuery: string): string;
  // appends `next=` with "?" or "&" depending on whether loginUrl already has a query
```
Changed 2026-10-08: the auth guard passes `safeNext(target, prefix)` to `externalLoginUrl`, never the raw target (decision 047). Both functions are unchanged.
Changed 2026-10-08: `safeNext` also judges the percent-decoded path; decoded whitespace and encoded `%2F` are allowed, decoded `.`/`..` segments, control characters and `\`, raw `//` and malformed escapes are rejected (user decision after the task 22 review; decision 032, consistent with decision 029).

`safeNext` returns a value only if every check below holds, in this order; the first failing check returns `${prefix}/`. Let `url = new URL(next, "http://x.invalid")`, `raw = url.pathname` (still percent-encoded) and `decoded = decodeURIComponent(raw)`.
1. `next` is non-empty, starts with `/`, and its second char is not `/` or `\`.
2. `next` (the whole raw string, query included) contains no `\`, no control character (U+0000-U+001F, U+007F) and no whitespace (JS `\s`). Literal whitespace is rejected; encoded whitespace (`%20`) is judged in step 6.
3. `new URL(...)` does not throw, `url.origin === "http://x.invalid"`, and `raw` starts with `${prefix}/` (this includes equality with `${prefix}/`).
4. `raw` contains no `//` (decision 032 (b)). Encoded `%2F` / `%2F%2F` is allowed here, as in decision 029. `//` in the query is allowed.
5. `decodeURIComponent(raw)` does not throw; a malformed percent escape is rejected (decision 032 (c)).
6. `decoded` contains no control character (U+0000-U+001F, U+007F) and no `\` (decision 032 (a)). Whitespace in `decoded` is allowed, e.g. `/admin/kv/a%20b/change/` for a text primary key with a space.
7. No segment of `decoded.split("/")` is `.` or `..` (decision 032 (d)), so the decoded target cannot leave the prefix. Empty segments from a decoded `%2F%2F` are allowed.

Changed 2026-10-08: dot segments that URL parsing normalizes are accepted (user answer; decision 032).
Dot segments are judged after URL normalization. A literal `.` or `..` segment, or a segment that is exactly `%2e` / `%2e%2e` (any case), is resolved by `new URL` before step 3. It is then accepted in normalized form if it stays under the prefix: `/admin/./x` → `/admin/x`, `/admin/a/../b/` → `/admin/b/`, `/admin/%2e/x` → `/admin/x`. It is rejected by step 3 if it leaves the prefix (`/admin/../x`, `/admin/%2e%2e/x` → `/x`). Step 7 rejects only percent-encoded dot segments that survive normalization because they are joined to a neighbour by an encoded slash, and that become `.`/`..` after decoding: `/admin/..%2Fx`, `/admin/%2e%2e%2fx`, `/admin/.%2Fx`, `/admin/a%2F..%2Fb/`.

The return value is `raw + url.search`: the URL parser's normalized, still-encoded form, never `decoded`. It therefore always satisfies the `Location` invariant of decision 029: a single-slash path under the prefix with no `\` and no control character.
The URL parser already resolves literal and `%2e` dot segments (`/admin/%2e%2e/x` → `/x`, then step 3 rejects it). It does not resolve segments joined by `%2F` (`/admin/..%2Fx` stays as is), and step 7 exists for those (evidence: 2026-10-08-safenext-decoded-path).
Callers must pass the raw percent-encoded path in `next`. Hono's `c.req.path` decodes `%20` to a space (evidence: 2026-10-08-safenext-decoded-path), which step 2 rejects, so the auth guard builds `next` from `new URL(c.req.url).pathname` (routes.md, decision 032).

### `locale.ts` (decision 050)
Changed 2026-10-09: new module.
```ts
import { DEFAULT_LOCALE, isLocale, type Locale } from "../messages.js";   // values: Changed 2026-10-09 (design review)
export const LOCALE_COOKIE = "da_lang";
export const LOCALE_MAX_AGE_SEC = 31536000;   // 365 days, below hono's 400-day limit
export function readLocale(c: Context): Locale;
  // v = getCookie(c, LOCALE_COOKIE) (hono/cookie, unsigned); isLocale(v) ? v : DEFAULT_LOCALE
export function writeLocale(c: Context, o: { prefix: string; publicOrigin: string | null }, locale: Locale): void;
  // setCookie(c, LOCALE_COOKIE, locale, { ...cookieAttrs(c, o.prefix, o.publicOrigin), maxAge: LOCALE_MAX_AGE_SEC })
```
- Unsigned on purpose: the value carries no secret and only `en` / `ja` can take effect, because `readLocale` accepts nothing else; any other value (missing, empty, `fr`, `JA`, `ja `) reads as `"en"` and is neither rewritten nor deleted (decision 050). `getCookie` never throws and takes the first `da_lang` pair (evidence: 2026-10-09-hono-plain-cookie-read), so `readLocale` is safe in `initVars`, before every other middleware.
- Set-Cookie attributes: `da_lang=<en|ja>; Max-Age=31536000; Path=<prefix or />; HttpOnly; SameSite=Lax`, plus `Secure` exactly when `isSecure(c, publicOrigin)`.
- Only the switch handler (routes-handlers.md "Language switch") calls `writeLocale`. Nothing deletes the cookie; `clearSession` (logout) does not touch it. `Accept-Language` is never read.

### `permissions.ts`
Changed 2026-10-07: custom-action permission fixed to `change` (decision 016).
Changed 2026-10-08: `canAny` added for the hidden-model rule (decision 043); the inheritance of unset entries lives in `ResolvedModel.permissions` (admin.md), so `can` is unchanged.
```ts
export type Perm = "view" | "add" | "change" | "delete";
export function can(model: ResolvedModel, perm: Perm, user: AdminUser): boolean;
export function canAny(model: ResolvedModel, user: AdminUser): boolean;
  // true if can() is true for at least one of view, add, change, delete; false = the model is hidden (decision 043)
export const ACTION_PERMISSION: Perm = "change"; // custom actions (decision 016); built-in delete_selected uses "delete"
```

## Data formats
Changed 2026-10-08: the HMAC key is the derived per-cookie key, not `secret` (decision 042).
- Session cookie value: hono signed-cookie format (URL-encoded JSON + `.` + base64 HMAC-SHA256 with the derived session key; tampered → `false`; evidence: 2026-10-07-hono-routing-cookies-script-escaping) of `{"u":...,"csrf":"...","iat":...}`.
- Flash cookie value: same format with the derived flash key, JSON array of `FlashMessage`.
- Locale cookie value (Changed 2026-10-09, decision 050): the plain string `en` or `ja`, unsigned.

## Errors
- Nothing throws on bad cookies; they read as absent. Token/Origin failures are turned into 403 by routes ([routes.md](routes.md)).
