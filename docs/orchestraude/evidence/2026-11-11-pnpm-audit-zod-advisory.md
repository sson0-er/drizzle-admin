---
id: 2026-11-11-pnpm-audit-zod-advisory
question: Do the dependencies in `pnpm-lock.yaml` have known vulnerabilities?
source: `pnpm audit` and `pnpm audit --prod` (pnpm 12.10.0, npm registry advisories), `pnpm view zod time`
fetched: 2026-11-11
expires: 2026-12-11
---
Learned:
- One advisory, severity high: GHSA-mrhx-c7xc-m3w5, "Zod can exhaust memory while validating oversized constrained collections", affects `zod` before 4.6.6. `zod` is the package's only runtime dependency; the lockfile had 4.6.5.
- Patched releases: 4.6.6 (2026-10-11) and 4.6.7 (2026-10-12).
- After raising the range to `^4.6.6` (lockfile 4.6.7), `pnpm audit` reports "No known vulnerabilities found" for all dependencies, dev included.
Not confirmed: whether the admin's own schemas (`src/forms/schema.ts`: objects of number, bigint, boolean, date, enum, string and unknown; no collection constraints) can reach the affected code path. The advisory text was not read beyond its title.
