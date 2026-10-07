---
id: 2026-10-07-drizzle-orm-release-lines
question: Which drizzle-orm release line is the latest stable, and what are its peer deps?
source: npm view drizzle-orm (dist-tags, peerDependencies), npm registry, 2026-10-07
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: dist-tag latest = 0.45.3 (published 2026-09-21). 1.0.0 exists only as beta (1.0.0-beta.22) and rc (1.0.0-rc.4 tag; rc.5 builds published up to 2026-09-09) tags, not latest. All drivers (better-sqlite3 >=7, @electric-sql/pglite >=0.2.0, etc.) are optional peers of drizzle-orm. Unknown: whether 1.0 stable will ship soon; whether the Column API differs in 1.0 (not checked).
