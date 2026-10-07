# Interface: auth

Files: `src/auth/session.ts`, `src/auth/csrf.ts`, `src/auth/flash.ts`, `src/auth/redirect.ts`, `src/auth/permissions.ts`.
Uses `hono/cookie` (`getSignedCookie`, `setSignedCookie`, `deleteCookie`) and `hono/csrf`. Web Crypto only (`crypto.getRandomValues`). No `node:` imports.

## Responsibilities
- Signed session cookie (§10) carrying user, CSRF token and issue time.
- CSRF: Origin/Sec-Fetch-Site check (`hono/csrf`) plus a constant-time hidden-token check.
- Flash messages across one redirect.
- Safe `next` handling and login redirect URLs.
- Permission evaluation.

## API

### `session.ts` (decisions 008, 014, 017)
Changed 2026-10-07: `CookieOpts` gained `publicOrigin` and `isSecure()` decides the `Secure` flag (decision 017); external-mode use fixed (decision 014).
```ts
export interface Session { u: AdminUser | null; csrf: string; iat: number } // iat = unix seconds
export const SESSION_COOKIE = "da_session";
export interface CookieOpts { secret: string; prefix: string; maxAgeSec: number; publicOrigin: string | null }
export async function readSession(c: Context, o: CookieOpts, now: number): Promise<Session | null>;
export async function writeSession(c: Context, o: CookieOpts, s: Session): Promise<void>;
export function clearSession(c: Context, o: CookieOpts): void;
export function newSession(user: AdminUser | null, now: number): Session; // fresh random csrf
export function newCsrfToken(): string;   // 32 random bytes, base64url (43 chars)
export function isSecure(c: Context, publicOrigin: string | null): boolean;
  // publicOrigin !== null ? publicOrigin.startsWith("https:") : new URL(c.req.url).protocol === "https:"
```
- `readSession` returns `null` if the cookie is missing, the signature is invalid (`getSignedCookie` → `false`), the JSON is malformed or has the wrong shape (validate: `u` null or `{id: string, name: string}`, `csrf` non-empty string, `iat` finite number), or `now - iat > maxAgeSec` or `iat > now + 60`.
- `writeSession` cookie attributes: `httpOnly: true`, `sameSite: "Lax"`, `path: prefix || "/"`, `maxAge: maxAgeSec`, `secure: isSecure(c, o.publicOrigin)`.
- External-auth mode (decision 014): the same cookie is used with `u` always `null`; it only carries `csrf` and `iat`. Callers never pass a user to `newSession` in external mode, and the user comes from `getUser` (routes.md).
- `clearSession` deletes with the same path.

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
```ts
export type FlashLevel = "success" | "warning" | "error";
export interface FlashMessage { level: FlashLevel; text: string }
export const FLASH_COOKIE = "da_flash";
export interface FlashOpts { secret: string; prefix: string; publicOrigin: string | null }
export async function addFlash(c: Context, o: FlashOpts, msgs: FlashMessage[]): Promise<void>;
export async function consumeFlash(c: Context, o: FlashOpts): Promise<FlashMessage[]>;
```
Signed cookie, `httpOnly`, `sameSite: "Lax"`, `path: prefix || "/"`, `maxAge: 60`, `secure: isSecure(c, o.publicOrigin)` (as for the session). `addFlash` appends to messages already set in this response. `consumeFlash` reads, validates the shape (invalid → `[]`) and deletes the cookie. Only pages rendered with 200/400 consume flash; redirects do not.

### `redirect.ts`
```ts
export function safeNext(next: string | undefined | null, prefix: string): string;
export function loginRedirectUrl(prefix: string, currentPathAndQuery: string): string;
  // `${prefix}/login/?next=${encodeURIComponent(currentPathAndQuery)}`
export function externalLoginUrl(loginUrl: string, currentPathAndQuery: string): string;
  // appends `next=` with "?" or "&" depending on whether loginUrl already has a query
```
`safeNext` returns `next` only if all of these hold, otherwise `${prefix}/`:
- non-empty, starts with `/`, the second char is not `/` or `\`;
- contains no `\`, no control characters (U+0000-U+001F, U+007F) and no whitespace;
- `new URL(next, "http://x.invalid")` has origin `http://x.invalid`, and its pathname starts with `${prefix}/` (or equals `${prefix}/`);
- the returned value is `pathname + search` of that URL (normalized).

### `permissions.ts`
Changed 2026-10-07: custom-action permission fixed to `change` (decision 016).
```ts
export type Perm = "view" | "add" | "change" | "delete";
export function can(model: ResolvedModel, perm: Perm, user: AdminUser): boolean;
export const ACTION_PERMISSION: Perm = "change"; // custom actions (decision 016); built-in delete_selected uses "delete"
```

## Data formats
- Session cookie value: hono signed-cookie format (URL-encoded JSON + `.` + base64 HMAC-SHA256; tampered → `false`; evidence: 2026-10-07-hono-routing-cookies-script-escaping) of `{"u":...,"csrf":"...","iat":...}`.
- Flash cookie value: same signing, JSON array of `FlashMessage`.

## Errors
- Nothing throws on bad cookies; they read as absent. Token/Origin failures are turned into 403 by routes ([routes.md](routes.md)).
