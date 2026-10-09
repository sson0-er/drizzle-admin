# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [03-design-review] No stated action if the Node 22 smoke job itself fails
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/release-checks.md
  - detail: engines >=22 rests on the smoke-node22 job ('CI proves it with the smoke test'), but evidence 2026-10-09-tarball-smoke-prototype and -node-minimum-version both say the run on Node 22 is not confirmed. That includes whether better-sqlite3 13.0.3's bundled prebuilds load on Node 22's ABI under --ignore-scripts. The 'Unverified until the first run' rule covers only MISE_NODE_VERSION propagation and mise trust. If the job fails for a library or driver reason, the implementer does not know whether to change engines, drop --ignore-scripts, or stop. Add one line, for example: 'If smoke-pack.sh fails on Node 22 for any other reason, the task is reported blocked; engines is not changed without a decision.' This follows the decision 020 pattern.
  - evidence: 2026-10-09-tarball-smoke-prototype
- [03-design-review] exports offers only the `import` condition
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md
  - detail: `"exports": { ".": { "types": ..., "import": "./dist/index.js" } }` has no `default` condition. On the Node lines that engines allows (22.12+ and 24), require(esm) works without a flag, but a CommonJS host calling require("@sson0-er/drizzle-admin") still gets ERR_PACKAGE_PATH_NOT_EXPORTED because no condition matches `require`. Consider `"default": "./dist/index.js"` in place of (or after) `import`. The same would then apply to the smoke consumer, which is ESM, so its result does not change. Keeping import-only is also fine if ESM-only is intended; in that case say so in the README Requirements.
  - evidence: (none)

