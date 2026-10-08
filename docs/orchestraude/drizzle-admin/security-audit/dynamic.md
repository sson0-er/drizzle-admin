# Dynamic (black-box) security check of the example app

- Date: 2026-10-08. Commit: `ad0ebeb` (working tree clean apart from this audit folder).
- Target: `HOST=127.0.0.1 PORT=3901 ADMIN_PASSWORD=probe-pass pnpm example` (in-memory SQLite, `basePath` `/admin`, plain http, `ADMIN_SECRET` unset so a random secret was used). All requests went to `127.0.0.1:3901` only. The server was stopped at the end (port 3901 closed, processes gone).
- Tool: curl. `B=http://127.0.0.1:3901`. "Valid token" means the `_csrf` value scraped from a page of the same session; "Origin ok" means `-H "Origin: $B"`.
- Item 8 was run separately in-process (no port) because the example has no password-widget column; see that section.
- Scratch files: `/tmp/claude-1000/-home-sshomaaa-devs-drizzle-admin/6d58579f-28c5-46c6-b0ed-9937fc21ad3d/scratchpad/probe/`.

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Unauthenticated access | PASS |
| 2a | Login wrong/correct password | PASS |
| 2b | Cookie attributes | PASS (NOTE: session payload readable, signed not encrypted) |
| 2c | Session fixation | PASS |
| 2d | Logout invalidation | NOTE (medium): an old cookie still works after logout; documented in README "Known limitations" |
| 2e | Login rate limiting | NOTE (low): none; documented in README |
| 3 | CSRF | PASS (NOTE: `Sec-Fetch-Site: same-origin` alone satisfies the Origin layer; the token is still required) |
| 4 | Open redirect (`next`, trailing-slash redirect) | PASS |
| 5 | XSS | PASS |
| 6a | Sort/page/search/filter/path/PK robustness | PASS |
| 6b | Bulk action with more than ~32k `_selected` ids | FAIL (low): 500 from SQLite "too many SQL variables" |
| 6c | Request size | NOTE (low): no body limit (50 MB body parsed, 5 MB value stored); decision 038 accepted this. Node rejects URLs over 16 KB with 431 |
| 7 | Security headers | NOTE (low): no `X-Content-Type-Options` and no CSP; `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Cache-Control: no-store` present |
| 8 | Password-widget column | N/A in the example; PASS in an in-process harness |

## 1. Unauthenticated access: PASS

Command pattern: `curl -s -o body -w '%{http_code} %header{location}' [-I | -X POST -H "Origin: $B" -d 'action=delete_selected&_selected_action=1&email=x'] $B<path>`

| Path | GET | HEAD | POST |
|---|---|---|---|
| `/admin/` | 302 `/admin/login/?next=%2Fadmin%2F` | 302 (same) | 302 `/admin/login/?next=%2Fadmin%2F` |
| `/admin/users/` | 302 `...next=%2Fadmin%2Fusers%2F` | 302 | 302 `...next=%2Fadmin%2F` |
| `/admin/users/add/` | 302 `...next=%2Fadmin%2Fusers%2Fadd%2F` | 302 | 302 `...next=%2Fadmin%2F` |
| `/admin/users/1/change/` | 302 | 302 | 302 `...next=%2Fadmin%2F` |
| `/admin/users/1/delete/` | 302 | 302 | 302 `...next=%2Fadmin%2F` |
| `/admin/posts/` | 302 | 302 | 302 |
| `/admin/nosuch/` | 302 | 302 | 302 |
| `/admin/logout/` | 302 | 302 | 302 |
| `/admin` | 302 `...next=%2Fadmin` | 302 | 302 |
| `/admin/static/admin.css` | 200 text/css (public by design) | 200 | 302 to login |

- Every redirect body was empty (size 0) and `Location` is path-only (`location: /admin/login/?next=%2Fadmin%2Fusers%2F`).
- A POST is redirected to the dashboard rather than replayed (by design).
- `PUT`/`DELETE`/`PATCH` without Origin: 403. `OPTIONS`: 302 to login. POST without Origin, or with `Origin: http://evil.example`: 403.
- Static route cannot be used to skip auth: `/admin/static/../users/`, `/admin/static/%2e%2e/users/`, `/admin/static/admin.css/../../users/`, `/admin/static/admin.css;/../users/`, `/admin/static//admin.css`, `/admin/STATIC/admin.css` (all with `--path-as-is`) all return 302 to login. Only `/admin/static/admin.css` (any query) returns the CSS.

## 2. Login, cookies, fixation, logout

### 2a. Wrong / correct password: PASS
```
curl -s -b pre.jar -H "Origin: $B" --data-urlencode "_csrf=$T" -d username=admin -d password=nope $B/admin/login/
-> 400, <p class="errornote">ユーザー名またはパスワードが正しくありません。
username=nobody password=probe-pass -> 400 (same generic message, no user enumeration)
username=admin password=probe-pass next=/admin/users/ -> 303, location: /admin/users/
```
The password is never echoed: the re-rendered `<input type="password">` has no `value`. The username is echoed escaped (`value="&quot;&gt;&lt;script&gt;..."`).

### 2b. Set-Cookie attributes: PASS (NOTE)
```
set-cookie: da_session=%7B%22u%22%3A%7B%22id%22%3A%22admin%22%2C%22name%22%3A%22admin%22%7D%2C%22csrf%22%3A%22hUPz...%22%2C%22iat%22%3A1791452867%7D.TZgF...%3D; Max-Age=28800; Path=/admin; HttpOnly; SameSite=Lax
```
- HttpOnly, SameSite=Lax, Path=/admin, Max-Age 8 h; no `Secure` on plain http (expected per `isSecure`).
- NOTE (info): the value is signed JSON, not encrypted, so the user id/name and the CSRF token are readable by anyone holding the cookie. It is HttpOnly, and the token is only useful together with the cookie, so this matters only if the cookie itself leaks.
- Tampering: changing `"admin"` to `"root"` in the payload, or sending unsigned JSON, gives 302 to login (signature rejected).

### 2c. Session fixation: PASS
- Pre-login GET issues an anonymous cookie (`u: null`, token `S3Dk...`). Successful login sets a new cookie with a new token (`hUPz...`).
- Replaying the pre-login cookie after the login: `GET /admin/users/` -> 302 to login (still anonymous).
- The pre-login token sent with the new authenticated cookie on a POST: 403.

### 2d. Logout invalidation: NOTE (medium; documented)
```
GET  /admin/logout/                                  -> 404 (logout is POST only)
POST /admin/logout/ Origin ok, no _csrf              -> 403
POST /admin/logout/ Origin evil, valid _csrf         -> 403
POST /admin/logout/ Origin ok, valid _csrf           -> 303 location: /admin/login/
                                                        set-cookie: da_session=; Max-Age=0; Path=/admin; HttpOnly; SameSite=Lax
Replay of the pre-logout cookie: GET /admin/users/   -> 200
```
The browser cookie is deleted, but the session is stateless, so a copied cookie stays valid until `iat + sessionMaxAgeSec` (8 h). README "Known limitations" states this ("Logout does not revoke the session"). Rotating `secret` is the only global revocation.

### 2e. Rate limiting: NOTE (low; documented)
30 consecutive wrong passwords in one session: all 400, then the correct password: 303. No throttle or lockout. README "Known limitations" states this.

## 3. CSRF: PASS (with a NOTE)

Matrix, authenticated session A (targets: `tags/add/`, `tags/7/change/`, `tags/8/delete/`, bulk `delete_selected` with `_confirm=1`, `logout/`):

| Request | add | change | delete | bulk | logout |
|---|---|---|---|---|---|
| no Origin, valid token | 403 | 403 | 403 | 403 | 403 |
| `Origin: http://evil.example`, valid token | 403 | 403 | 403 | 403 | 403 |
| `Origin: null`, valid token | 403 | 403 | 403 | 403 | 403 |
| Origin ok, no token | 403 | 403 | 403 | 403 | 403 |
| Origin ok, wrong token (`AAAA`+token) | 403 | 403 | 403 | 403 | 403 |
| Origin ok, empty token | 403 | 403 | 403 | 403 | 403 |
| Origin ok, token of authenticated session B | 403 | 403 | 403 | 403 | 403 |
| `Sec-Fetch-Site: cross-site` (no Origin), valid token | 403 | 403 | 403 | 403 | 403 |
| `Content-Type: text/plain`, evil Origin | 403 | 403 | 403 | 403 | 403 |
| `Content-Type: application/json`, no Origin | 403 | 403 | 403 | 403 | 403 |
| `Sec-Fetch-Site: same-origin` (no Origin), valid token | 303 | 303 | 303 | 303 | 303 |

Login POST (anonymous session): no Origin / evil / `null` with valid token, Origin ok with no / wrong token, and the token of another (authenticated) session all give 403. No cookie at all with Origin ok and a scraped token: 403. Origin ok with valid token: 303.

NOTE (info): `Origin: http://evil.example` plus `Sec-Fetch-Site: same-origin` with a valid token passes (303 on login). Hono's `csrf()` passes when either the Origin or the Sec-Fetch-Site check passes. Browsers do not let pages forge either header, and the per-session token is still required, so this is not exploitable from a browser. It only means that the Origin layer alone is weaker than "Origin must match".

## 4. Open redirect: PASS

`next` was sent both in the login POST (`--data-urlencode "next=$n"`, then 303) and in `GET /admin/login/?next=...` while logged in (302).

| `next` | POST login Location | GET (authenticated) Location |
|---|---|---|
| `//evil.example` | `/admin/` | `/admin/` |
| `/\evil.example` | `/admin/` | `/admin/` |
| `/%09/evil.example` and a literal tab | `/admin/` | `/admin/` |
| `https://evil.example`, `http:evil.example` | `/admin/` | `/admin/` |
| `/..//evil.example`, `/admin/..//evil.example`, `/admin/%2e%2e//evil.example` | `/admin/` | `/admin/` |
| `javascript:alert(1)`, `data:text/html,x` | `/admin/` | `/admin/` |
| `%2F%2Fevil.example`, `/%2F/evil.example`, `/%5Cevil.example`, `///evil.example` | `/admin/` | `/admin/` |
| `/admin//evil.example`, `/admin/\evil.example`, `/admin/\n/evil`, ` /admin/` | `/admin/` | `/admin/` |
| `/other/path`, `/admin/../../etc` | `/admin/` | `/admin/` |
| `/admin/users/?q=1` | `/admin/users/?q=1` | `/admin/users/?q=1` |

- The hidden `next` field on the login page only carries vetted values: `next="><script>...` renders `value="/admin/"`; `next=/admin/"><script>...` renders `value="/admin/%22%3E%3Cscript%3Ealert(1)%3C/script%3E"`.
- Trailing-slash redirect (authenticated, `--path-as-is`): `/admin/users?q=%3Cx%3E` -> 301 `/admin/users/?q=%3Cx%3E`; `/admin//evil.example`, `/admin/%5Cevil.example`, `/admin/%09/evil.example`, `/admin/%0d%0aSet-Cookie:x=1`, `/admin/a%0aLocation:%20http://evil` -> 404 (no header injection); `/admin/%2F%2Fevil.example` -> 301 `/admin/%2F%2Fevil.example/` (path-only, stays under `/admin`).

## 5. XSS: PASS

Stored payloads (all accepted with 303):
- user: `email="><img src=x onerror=alert(2)>`, `name=<script>alert(1)</script>`
- post 61: `title=<script>alert(1)</script>'><svg onload=alert(4)>`, `body=javascript:alert(3)`, `metadata={"x":"</textarea><script>alert(5)</script>"}`, `authorId` = the payload user (FK label)
- tag: `name=javascript:alert(3)`

Raw-pattern count (`<script>alert|<img src=x|<svg onload|href="javascript:|</textarea><script`) on each page was 0; escaped forms were present:

| Page | raw | escaped occurrences |
|---|---|---|
| `/admin/` (flash after save) | 0 | `&lt;script&gt;alert`, `&lt;svg onload` |
| `/admin/users/`, `?q=...` | 0 | `&quot;&gt;&lt;img` |
| `/admin/users/6/change/`, `/admin/users/6/delete/` | 0 | 4-5 |
| `/admin/posts/`, `?q=svg`, `?authorId=6` (FK label) | 0 | yes |
| `/admin/posts/61/change/` (incl. JSON textarea `&lt;/textarea&gt;`) | 0 | yes |
| `/admin/posts/61/delete/` | 0 | yes |
| `/admin/tags/` (`javascript:` stored as text) | 0 | no `href="javascript:` |
| Bulk confirm (`deactivate`, `delete_selected` on user 6) | 0 | 1 |
| Flash after custom action ("1 user(s) deactivated") | 0 | n/a |

Reflected input with `X='"><script>alert(9)</script>'`:
- `?q=$X` on the users list: escaped once (`value="&quot;&gt;&lt;script&gt;alert(9)&lt;/script&gt;"`).
- `?o=`, `?p=`, `?isActive=`, `?role=`, `?status=`, `?authorId=`, `?publishedAt=`, `?e=`, `?_popup=` and an unknown parameter name: no raw output; invalid values are ignored.
- Form error re-render (duplicate email -> 400 with generic "同じ値のデータが既に存在します。"; invalid JSON, invalid FK and datetime -> 400): raw 0, values escaped.
- Invalid enum `role=<script>...`: 400, raw 0.
- Unknown action name or `_selected` payload: 303, nothing rendered.
- Error pages: unknown model `/admin/%3Cscript%3E.../` -> 404, PK payload in change URL -> 404; raw 0.

## 6. Injection and robustness

### 6a. PASS
All with the authenticated cookie, `--path-as-is`:
- `?o=` `nosuch`, `-email`, `email;DROP TABLE users`, `1 desc`, `--id`, `id,email`, empty, `__proto__`, `constructor`, `toString`: 200, no SQL text in the body; the users table still worked afterwards.
- `?p=` `999999999999999999999`, `-1`, `0`, `abc`, `1e3`, `2.5`, `NaN`, `Infinity`, `1&p=2`: 200.
- `?q=` `%`, `_`, `%%%`, `\`: 200 with no matches (wildcards are escaped; an unescaped `%` would have listed every user). `'`, `' OR 1=1--`: 200, no matches. `"`: 200, matches only the user whose email contains `"`. `a%00b`: 200.
- Filters `isActive=2`, `role=root`, `authorId=1 OR 1=1`, `publishedAt=evil`, `isActive=1&isActive=0`: 200, ignored.
- Models `nosuch`, `__proto__`, `constructor`, `toString/add`, `hasOwnProperty/1/change`: 404 (prototype names are not resolved).
- Traversal `/admin/../etc/passwd`, `/admin/users/../../etc/passwd`, `/admin/%2e%2e/%2e%2e/etc/passwd`: plain 404 from the host app; `/admin/users/%2e%2e/` normalizes to the dashboard (auth still applied).
- PKs `999999`, `-1`, `1.5`, `abc`, `1e2`, `0x1`, `%20%201`, a 23-digit and a 5000-digit number: 404. `01` -> 200 (user 1; integer coercion, harmless). Non-existent PK on delete: 404.
- Raw DB errors never reached the response or the log: the log only has `drizzle-admin: other SqliteError SQLITE_ERROR`.

### 6b. FAIL (low): bulk action with too many ids returns 500
```
curl -s -b a.jar -H "Origin: $B" --data-binary @s.txt $B/admin/tags/
  # s.txt = _csrf=<token>&action=delete_selected&_selected=0&_selected=1&...
30000 ids -> 200 (confirm page)
33000 ids -> 500 "サーバーエラーが発生しました。"
100000 ids -> 500
users, action=deactivate (confirm: true), 40000 ids -> 500
users, action=activate (no confirm), 40000 ids -> 303
log: drizzle-admin: other SqliteError SQLITE_ERROR
```
The selected ids are bound as one `IN (...)` list, which exceeds SQLite's variable limit (32766). PostgreSQL has a similar limit (65535 parameters). Only an authenticated user with a valid token can trigger it; the result is a generic 500 page with no leaked detail, so the impact is a confusing error, not a security breach. Possible fix: reject or cap the number of selected ids with a validation message.

### 6c. NOTE (low): request size
- No body limit in the library (decision 038; README tells deployers to limit it at the proxy). A 50 MB urlencoded body with a valid token was fully parsed (400 form error, 0.14 s); a 50 MB body without a valid token or unauthenticated was also read before the 403. A 5 MB tag name was stored (303), and the tags list now renders that 5 MB value on every view.
- Node's default 16 KB header limit rejects long URLs before the app: `?q=` of 100 KB or 1 MB, `?o=` of 100 KB and a 100 000-digit PK all got `431`. A 5000-digit PK got 404.
- Server RSS after these probes was about 280 MB; the server stayed responsive.

## 7. Response headers: NOTE (low)

Authenticated `GET /admin/`, `/admin/users/`, `/admin/users/1/change/`, 404 and 403 pages:
```
cache-control: no-store
content-type: text/html; charset=UTF-8
referrer-policy: same-origin
x-frame-options: DENY
```
- Present: `Cache-Control: no-store` (the CSS gets `public, max-age=31536000, immutable`), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (also on the CSS and redirects).
- Absent: `X-Content-Type-Options: nosniff` and `Content-Security-Policy` (so no `frame-ancestors` either; `X-Frame-Options: DENY` covers framing). No design decision about them was found. The pages contain one inline `<script>` (select-all on the list), so a CSP would need a hash or nonce. Responses outside the admin (the host app's plain 404) carry none of these headers, which is the host app's concern.

## 8. Password-widget column: N/A in the example, PASS in a harness

`example/app.ts` registers no `widgets: { ...: "password" }`, so this could not be checked against the example server. Instead an in-process harness (`scratchpad/probe/pw/harness.ts`, no port, calls `admin.fetch`) registered a table `accounts(id, login, secret)` with `widgets: { secret: "password" }`, `listDisplay: ["id","login","secret"]`, `searchFields: ["login"]`, and seeded `secret` values `SEKRET-ALICE-123` and `SEKRET-BOB-456`.

| Request | Status | Stored secret in body | `********` shown |
|---|---|---|---|
| list | 200 | no | yes |
| list `?o=secret`, `?o=-secret`, `?o=2` | 200 | no; row order is identical for `secret` and `-secret` (sort ignored, no ordering oracle) | yes |
| `?q=SEKRET` | 200 | only the echoed query text; 0 rows (the column is not searched) | n/a |
| `?secret=SEKRET-ALICE-123` | 200 | only the echoed query in form/link URLs; 2 rows (not filtered, no oracle) | yes |
| change form | 200 | no | n/a |
| delete confirm, bulk delete confirm | 200 | no | n/a |
| change with `validate` error, change with unique error, add with unique error (submitted `NEWSECRET-*`) | 400 | no (submitted value not echoed either) | n/a |
| change with empty password | 303 | stored value kept (`SEKRET-ALICE-123`), as documented | n/a |
