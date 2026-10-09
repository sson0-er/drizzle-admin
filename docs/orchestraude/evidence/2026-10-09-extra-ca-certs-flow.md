---
id: 2026-10-09-extra-ca-certs-flow
question: Does the OIDC flow run end to end with the mock IdP on https://localhost trusted via NODE_EXTRA_CA_CERTS, without disabling TLS verification, in a launcher and in vitest?
source: local experiments in a scratch dir (Node v24.21.0, hono 4.13.13, @hono/oidc-auth 1.10.0, oidc-provider 9.12.2, selfsigned 5.5.0, vitest 5.0.3); node_modules/vitest cli help in this repo
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- Launcher mode: a parent process generates the cert (selfsigned), writes ca.pem/key.pem to a mkdtemp dir, spawns process.execPath child with env NODE_EXTRA_CA_CERTS=<ca.pem>; the child runs the IdP (https.createServer + oidc-provider callback) and the app (http, @hono/node-server) and drives the flow by fetch. Flow passed: unauthenticated /admin/users/?q=a -> 302 /oidc/login?next=... -> IdP -> callback -> back to login route -> 302 to validated next -> page 200 via a Request-keyed WeakMap getUser-style bridge -> evil next replaced by "/" -> logout -> next request 302 to login. Flow 78 ms; launcher total 230 ms (0.32 s wall).
- Negative control: with NODE_EXTRA_CA_CERTS pointing at the system bundle only, the same flow failed (500 at the first redirect, untrusted cert), so trust really came from the extra CA.
- vitest 5.0.3 (default pool forks): a globalSetup that generates the cert and sets process.env.NODE_EXTRA_CA_CERTS before workers spawn works; the test file reads key/cert from a dir named in env and runs the same flow: 1 test passed, 347-362 ms total. With pool: "threads" the same setup FAILED (worker threads do not re-read the variable). Repo's vitest.config.ts sets no pool; vitest default is forks (cli help in node_modules).
- TLS verification was never disabled (the harness asserts NODE_TLS_REJECT_UNAUTHORIZED is not "0").
Not confirmed: real drizzle-admin createAdmin/getUser (the admin was mimicked by a Hono sub-app); vitest with fileParallelism/other pools such as vmForks; CI on other OSes; Windows.
