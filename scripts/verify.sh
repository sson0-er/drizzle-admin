#!/usr/bin/env bash
# Verify gate: runs every check in order and stops at the first failure.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v mise >/dev/null 2>&1; then
  pnpm_cmd=(mise exec -- pnpm)
else
  pnpm_cmd=(pnpm)
fi

for step in test typecheck lint build; do
  echo "==> pnpm ${step}"
  "${pnpm_cmd[@]}" "${step}"
done
