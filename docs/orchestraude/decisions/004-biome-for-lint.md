# 004: Biome 2.5.15 for lint and format checks

- Date: 2026-10-07
- Status: accepted

## Context
Requirements leave the lint tool to the design. `pnpm lint` must pass at every phase. TypeScript is 7.0.2 (decision 003).

## Decision
`@biomejs/biome` 2.5.15 (exact), `pnpm lint` = `biome check .` (lint + format check + import organization). Rules: recommended set plus `suspicious/noExplicitAny: error`, `security/noDangerouslySetInnerHtml: error`, and `correctness/noNodejsModules: error` for `src/**`.

## Alternatives considered
- ESLint 10 + typescript-eslint: the latest typescript-eslint (8.71.1) peers `typescript <6.1.0`, so it is incompatible with TS 7.
- No linter: the requirements demand `pnpm lint`.

## Rationale
typescript-eslint does not support TS 7 (evidence: 2026-10-07-ts7-vitest-biome-compat). Biome needs no TS compiler API. Biome rejects `any`, and a suppression with an empty reason is an error (evidence: 2026-10-07-ts7-vitest-biome-compat). This enforces the requirement "`any` only at the Drizzle boundary with a reason comment": each allowed `any` carries `// biome-ignore lint/suspicious/noExplicitAny: <reason>`.

## Consequences
- No type-aware lint rules (Biome does not use the type checker); `tsc --noEmit` covers type errors.
