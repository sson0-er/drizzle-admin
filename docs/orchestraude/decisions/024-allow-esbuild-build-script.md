# 024: Allow the esbuild build script in pnpm config

- Date: 2026-10-07
- Status: accepted

## Context
`mise exec -- pnpm install` (pnpm 12.10.0) exits non-zero with `ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: esbuild@0.28.2`. esbuild is a transitive dependency of tsx and vite (vitest). The earlier probe did not install tsx, so this was unverified (evidence: 2026-10-07-pnpm-mise-and-native-deps, "Unknown").

## Decision
`pnpm-workspace.yaml` contains `allowBuilds: { esbuild: true }` (written by `pnpm approve-builds esbuild`). No other package is allowed to run build scripts.

## Alternatives considered
- Leave it ignored: `pnpm install` exits non-zero, which breaks the "clean checkout installs" requirement.
- Allow all builds: broader than needed.

## Rationale
The Definition of Done of task 01 requires `pnpm install` to exit 0. Only esbuild is reported, so only esbuild is approved.

## Consequences
- esbuild's postinstall (`node install.js`, binary check) runs on install.
