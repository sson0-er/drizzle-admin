#!/usr/bin/env bash
# Smoke test: packs the package, installs the tarball into a clean temporary project and runs a consumer.
set -euo pipefail
cd "$(dirname "$0")/.."

# The consumer lives outside the repository, where mise.toml does not apply, so the pinned tools
# must already be on PATH for every child process (npm, node, tsc and the `pnpm build` of prepack).
# MISE_NODE_VERSION set by the caller still applies (CI uses it for Node 22).
if command -v mise >/dev/null 2>&1 && [ -z "${SMOKE_PACK_UNDER_MISE:-}" ]; then
  exec env SMOKE_PACK_UNDER_MISE=1 mise exec -- bash scripts/smoke-pack.sh "$@"
fi

node --version

# Outside the repository so module resolution cannot fall back to its node_modules.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

specs=()
for name in drizzle-orm hono better-sqlite3 @electric-sql/pglite typescript @types/better-sqlite3 @types/node; do
  version="$(node -p 'require("./package.json").devDependencies[process.argv[1]]' "$name")"
  specs+=("$name@$version")
done

# prepack runs the build, so the tarball holds a fresh dist/.
npm pack --pack-destination "$work"
tarballs=("$work"/*.tgz)
if [ "${#tarballs[@]}" -ne 1 ] || [ ! -f "${tarballs[0]}" ]; then
  echo "smoke-pack: expected exactly one tarball in $work, found ${#tarballs[@]}" >&2
  exit 1
fi
tarball="${tarballs[0]}"

entries="$(tar -tzf "$tarball")"
for required in package/src/index.ts package/dist/index.js; do
  if ! grep -qxF "$required" <<<"$entries"; then
    echo "smoke-pack: tarball entry missing: $required" >&2
    exit 1
  fi
done
unexpected="$(grep -E '^package/(test|example|scripts)/' <<<"$entries" || true)"
if [ -n "$unexpected" ]; then
  echo "smoke-pack: unexpected tarball entries:" >&2
  echo "$unexpected" >&2
  exit 1
fi

mkdir "$work/consumer"
cp scripts/smoke/consumer.ts scripts/smoke/tsconfig.json "$work/consumer/"
echo '{ "name": "smoke-consumer", "private": true, "type": "module" }' >"$work/consumer/package.json"

cd "$work/consumer"
# Safe because better-sqlite3 ships prebuilt binaries and has no install script.
npm install --ignore-scripts --no-audit --no-fund "$tarball" "${specs[@]}"

./node_modules/.bin/tsc -p tsconfig.json
node out/consumer.js

# Needs the "default" export condition and require(esm) without a flag (Node 22.12+).
node --input-type=commonjs -e '
const m = require("@sson0-er/drizzle-admin");
if (typeof m.createAdmin !== "function") {
  console.error("require(): createAdmin missing");
  process.exit(1);
}
console.log("ok require");
'

echo "smoke-pack: ok"
