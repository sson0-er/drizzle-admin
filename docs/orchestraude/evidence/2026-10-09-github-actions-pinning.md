---
id: 2026-10-09-github-actions-pinning
question: For decision 052, how should the CI workflow pin actions and provision node/pnpm consistently with mise.toml?
source: https://docs.github.com/en/actions/reference/security/secure-use; `git ls-remote` / `gh release view` on actions/checkout and jdx/mise-action; jdx/mise-action action.yml and src/index.ts (main); jdx/mise docs/configuration/environment-variables.md
fetched: 2026-10-09
expires: 2026-11-08
---
Learned:
- GitHub: "Pinning an action to a full-length commit SHA is currently the only way to use an action as an immutable release"; tags can be moved or deleted if an account is compromised; recommended default `GITHUB_TOKEN` permission is read-only contents.
- Latest releases: actions/checkout v7.0.1 (2026-07-20) = commit 3d3c42e5aac5ba805825da76410c181273ba90b1 (lightweight tag); jdx/mise-action v5.1.1 (2026-10-04) = commit 2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca (lightweight tag).
- mise-action reads the repo's mise.toml and runs `mise install` (input `install`, default true), caches installs (`cache`, default true), accepts `version` for the mise binary (unset = newest release older than `minimum_release_age`, default 24h) and verifies the downloaded mise binary against minisign-signed SHASUMS256.txt.
- mise: `MISE_<TOOL>_VERSION` (e.g. `MISE_NODE_VERSION=22`) overrides every config file for the commands that see it. Local mise is 2026.10.3.
Not confirmed: that the job-level `MISE_NODE_VERSION` is honored by mise-action's own `mise install` step and by its cache key (first CI run shows it); whether mise needs `mise trust` for a tools-only mise.toml in CI.
