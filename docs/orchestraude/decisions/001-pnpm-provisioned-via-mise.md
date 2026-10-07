# 001: Provision pnpm 12.10.0 through mise.toml

- Date: 2026-10-07
- Status: accepted

## Context
pnpm was not installed on the machine, and `pnpm test/typecheck/lint/build` are acceptance commands. After research the user decided that pnpm is provisioned through mise.toml with a pinned version. The user then added the pin to mise.toml themselves.

## Decision
pnpm 12.10.0 is provisioned via `mise.toml` (`pnpm = "12.10.0"`, next to `node = "24.21.0"`), pinned by the user. mise.toml is the single source of the pnpm version: no `packageManager` field and no corepack usage. No implementation task edits mise.toml.

## Alternatives considered
- corepack (`corepack enable` + `packageManager` field): rejected by the user's decision.
- Global `npm i -g pnpm`: not reproducible and not pinned in the repo.

## Rationale
mise already pins Node and now pins pnpm 12.10.0; `pnpm --version` prints 12.10.0 under mise (evidence: 2026-10-07-pnpm-mise-and-native-deps). With pnpm 12.10.0, the native test dependency better-sqlite3 13.0.3 installed and loaded without any build-approval config (evidence: 2026-10-07-pnpm-mise-and-native-deps).

## Consequences
- Contributors need mise (or the same pnpm version installed by other means). The README states this.
- A `packageManager` field could disagree with mise; it is deliberately omitted.
