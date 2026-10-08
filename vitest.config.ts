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
  },
});
