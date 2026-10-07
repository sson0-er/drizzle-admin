# 002: drizzle-orm peer range ^0.45.3, dev dependency pinned to 0.45.3

- Date: 2026-10-07
- Status: accepted

## Context
Requirements: drizzle-orm is a peerDependency, only the latest stable release line is supported, and the dev dependency is pinned exactly. Pre-spec §3 says "pin the installed version".

## Decision
- `peerDependencies`: `"drizzle-orm": "^0.45.3"` (for 0.x this means >=0.45.3 <0.46.0).
- `devDependencies`: `"drizzle-orm": "0.45.3"` (exact).
- All Drizzle-internal access stays in `src/introspect/` (column metadata) and `src/data/` (query building).

## Alternatives considered
- `^0.45.0`: covers the whole 0.45 line, but 0.45.0-0.45.2 are never tested.
- `>=0.45.3 <2`: would claim support for 1.0 (beta/rc only, Column API differences unverified).
- Exact peer `0.45.3`: forces consumers onto one patch; needlessly strict for a peer.

## Rationale
0.45.3 is `latest`; 1.0 exists only as beta/rc (evidence: 2026-10-07-drizzle-orm-release-lines). Introspection was verified only on 0.45.3 (evidence: 2026-10-07-drizzle-column-introspection, 2026-10-07-drizzle-column-variants). The lower bound equals the tested version and the upper bound ends at the release line.

## Consequences
- Supporting drizzle 1.0 later needs a new decision and changes confined to `src/introspect/` and `src/data/`.
