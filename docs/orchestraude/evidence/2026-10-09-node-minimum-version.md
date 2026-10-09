---
id: 2026-10-09-node-minimum-version
question: For decision 052, what minimum Node version do the library code and its runtime dependencies need, and which Node lines are supported on 2026-10-09?
source: node_modules package.json `engines` (installed versions); grep of src/ for runtime globals; https://nodejs.org/api/globals.html (crypto); https://nodejs.org/en/about/previous-releases
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `engines`: hono 4.13.13 `>=16.9.0`; zod 4.6.5 and drizzle-orm 0.45.3 none. Dev/test only: better-sqlite3 13.0.3 `>=22`, vitest 5.0.3 `^22.12.0 || ^24.0.0 || >=26.0.0`, @hono/node-server 2.1.3 `>=20`, typescript 7.0.2 `>=16.20.0`.
- src/ uses the globals `crypto.subtle` and `crypto.getRandomValues` (src/auth/session.ts), `TextEncoder`, `btoa`, `Intl.DateTimeFormat` with time zones (src/time.ts), plus `Request`/`Response`/`URL`. The build targets ES2022 syntax.
- Node docs: the global `crypto` was added in v17.6.0 behind `--experimental-global-webcrypto`; since v19.0.0 it needs no flag; stable since v23.0.0.
- Release page: v20 is EOL (listed as 2026-03-24); v22 and v24 are LTS; v26 is Current.
Not confirmed: that the library runs on Node 22 (no local Node 22); whether any hono 4.13 internals need more than the globals above (hono declares `>=16.9.0`).
