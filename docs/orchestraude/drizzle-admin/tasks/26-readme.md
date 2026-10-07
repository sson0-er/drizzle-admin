---
id: 26-readme
depends_on: [25-polish-css-and-fk-fallback]
status: pending
attempts: 0
---
# Task 26: readme

## Goal
The README documents setup, every configuration and model option with defaults and constraints, actions, authentication and security (including reverse-proxy deployment with `publicOrigin`), behavior notes, known limitations (including no login rate limiting) and development / example run instructions. This completes phase 6.

## Scope
### Files to touch
- README.md
- test/readme.test.ts (new)
### Do not touch
- mise.toml, docs/** (except this task's History)
- src/**, example/**, package.json, LICENSE

## Implementation notes
- Outline (12 sections, English): `interfaces/project-setup.md` "README.md outline". Take option defaults and constraints from the code as built and from `interfaces/admin.md` (createAdmin table, register step 5, finalization, ResolvedModel defaults), the allowed-widgets table from `interfaces/forms.md#fieldsts`, behavior notes from decision 013, the `HookCtx` shape (decision 015), action permission (decision 016), `publicOrigin` (decision 017) and date-only string support (decision 023).
- Section 8 contains the subsection "Deploying behind a reverse proxy" as described in the outline.
- Section 10 "Known limitations" lists: no login rate limiting, no composite PKs, no MySQL, no file uploads, no inlines/history, Japanese UI only, SQLite needs `PRAGMA foreign_keys = ON` for FK errors (better-sqlite3 enables it by default), drizzle-orm 0.45 only.
- Section 11 includes the run instructions from `interfaces/example.md` "Data formats" (`mise install`, `pnpm install`, `pnpm example`, open `http://localhost:3000/admin/`, log in as `admin` / `admin`).
- Do not claim anything that is not implemented; describe only behavior that exists in src.

## Definition of Done
- [ ] README.md has the 12 sections of the outline in order, as `##` headings.
- [ ] README.md documents every `AdminConfig` field (`db`, `dialect`, `basePath`, `siteTitle`, `secret`, `auth`, `sessionMaxAgeSec`, `timeZone`, `publicOrigin`), every `AuthConfig` field and every `ModelAdminOptions` field by name with its default.
- [ ] Tests: `test/readme.test.ts` reads README.md and asserts it contains a `Known limitations` heading whose section mentions rate limiting, a `Deploying behind a reverse proxy` heading mentioning `publicOrigin`, and every `AdminConfig` and `ModelAdminOptions` key name.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md (section "README.md outline")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/admin.md
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/forms.md#fieldsts
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md (section "Data formats")
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (§10 row "Login rate limiting not implemented")
- Decisions: docs/orchestraude/decisions/013-unspecified-page-behaviors.md, 014-external-auth-csrf-token.md, 015-hookctx-definition.md, 016-custom-action-permission.md, 017-public-origin.md, 021-widget-override-compatibility.md, 023-pg-date-string-mode-support.md

## History
