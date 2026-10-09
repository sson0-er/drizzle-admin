---
id: 2026-10-09-require-esm
question: For decision 052 (design review, release round), can a CommonJS host require() the ESM-only package, and which exports condition does it need?
source: https://nodejs.org/api/modules.html ("Loading ECMAScript modules using require()"); local run on node 24.21.0 against the packed tarball in a scratch consumer
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- Node docs: require(esm) added in v22.0.0 / v20.17.0 behind `--experimental-require-module`; unflagged in v23.0.0, v22.12.0, v20.19.0; no experimental warning by default since v23.5.0, v22.13.0, v20.19.0; no longer experimental in v25.4.0. A graph with top-level `await` throws `ERR_REQUIRE_ASYNC_MODULE`. `require()` returns the module namespace object (named exports as properties).
- With `exports` `{ types, import }`, `node --input-type=commonjs -e 'require("<pkg>")'` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` on Node 24.21.0. Adding `"default": "./dist/index.js"` makes the same call return the namespace with `createAdmin` a function, without a warning; the ESM consumer still passes on SQLite and PGlite. So the package's graph (incl. hono, zod) has no top-level await.
Not confirmed: the same require() on Node 22 (not installed locally; CI's Node 22 job runs it); TypeScript CommonJS consumers' type resolution (not checked).
