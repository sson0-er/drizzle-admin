import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    environment: "node",
    // Each PGlite-backed `setup()` boots a WASM Postgres, which exceeds the
    // default 5 s timeout when many test files run in parallel. Bounded, so a
    // real hang still fails.
    testTimeout: 30_000,
    // Same reason: `makeAdmin` calls `setup()` from beforeEach/beforeAll hooks.
    hookTimeout: 30_000,
    // The OIDC test trusts its mock IdP through NODE_EXTRA_CA_CERTS, which Node reads only when a
    // process starts: workers must be child processes spawned after the global setup has set it.
    // forks is vitest's default; pinned so a change of default or a switch to threads fails loudly
    // here instead of as a TLS error (decision 053).
    pool: "forks",
    globalSetup: ["test/helpers/oidc-global-setup.ts"],
  },
});
