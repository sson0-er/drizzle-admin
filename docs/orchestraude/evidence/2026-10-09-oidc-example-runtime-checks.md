---
id: 2026-10-09-oidc-example-runtime-checks
question: For decision 053, does the repo's toolchain support the launcher and the getUser bridge (tsx via --import, hono mount sharing the Request and headers, localhost resolution)?
source: local runs in a scratch dir with this repo's node_modules (Node v24.21.0 via mise, tsx 4.23.15, hono 4.13.13); /etc/hosts of the dev machine
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `node --import tsx <file.ts>` (run from the repo root, so `tsx` resolves from its node_modules) runs a TypeScript file on Node 24.21.0; a child spawned that way sees the env it was given.
- hono 4.13.13: `app.use("/admin/*", mw)` ran for `/admin`, `/admin/` and `/admin/x/`. A sub-app mounted with `app.route("/admin", sub)` saw the same `c.req.raw` object (a `WeakMap` keyed by it hit). A cookie set with `setCookie` in the outer middleware before `await next()` appeared on the sub-app's `c.html(...)` and `c.redirect(...)` responses.
- `localhost` resolves to `::1` then `127.0.0.1` here; Node's `fetch("http://localhost:<port>/")` reached a server bound only to `127.0.0.1` and one bound only to `::1`.
- Added 2026-10-10: `fetch("https://localhost:<port>/")` to an https server on 127.0.0.1 with a self-signed EC P-256 leaf (SAN localhost/127.0.0.1, CA:FALSE, made with openssl) that is not in any trust store rejects with `TypeError: fetch failed`, `cause.code` `DEPTH_ZERO_SELF_SIGNED_CERT` (Node 24.21.0, verification on).
Not confirmed: browsers reaching a `127.0.0.1`-only server through `localhost` (expected, not tested); other OSes' hosts files; the refresh path of `getAuth` (cookie re-set) through the real admin app.
