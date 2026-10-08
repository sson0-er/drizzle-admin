---
id: 37-claude-md
depends_on: [27-fk-ordering-and-example, 28-fk-reference-view-permission, 29-vanished-rows-warnings, 30-cookie-deletion-and-head-guard, 31-password-keep-on-empty, 32-password-no-echo, 33-security-test-fixes, 34-test-gaps-data-time, 35-test-gaps-forms-views-auth, 36-readme-and-hardening]
status: pending
attempts: 0
---
# Task 37: claude-md

## Goal
`CLAUDE.md` gives contributors and coding agents a short, accurate project guide, written against the final code after tasks 27-36. It covers:
- what the project is;
- the commands;
- the directory layout;
- the key design principles and security rules;
- where decisions, evidence and the review policy live;
- workflow rules for agents.

The existing "Conventions" section stays word for word.

## Scope
### Files to touch
- CLAUDE.md
### Do not touch
- The `## Conventions` heading and its six bullets in CLAUDE.md (keep them byte-identical; you may move the section as a whole)
- Every other file (README.md, src/**, test/**, example/**, docs/** except this task's History)
- Do not commit.

## Implementation notes
- Keep it concise: at most 80 lines in total, in English, using bullet lists. Do not copy design text. Point to the files instead.
- Sections (`##` headings; the exact wording is up to you):
  1. Overview: one or two sentences. An ESM TypeScript library that turns registered Drizzle tables into a server-rendered, Django-admin-like CRUD UI on Hono; SQLite and PostgreSQL; Japanese UI.
  2. Commands:
     - `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`;
     - `scripts/verify.sh`, which runs all four in order and is the gate for every change;
     - `pnpm example`, the demo on `127.0.0.1:3000`, with `HOST` / `PORT` / `ADMIN_PASSWORD` / `ADMIN_SECRET`;
     - tools come from `mise.toml` (`mise install`).
     Take the script names from `package.json` and the bind address from `example/server.ts`.
  3. Layout: one line each for `src/` (with its subdirectories `introspect`, `data`, `forms`, `auth`, `routes`, `views`, `static`, plus `messages.ts`, `time.ts`, `types.ts`, `admin.ts`, `index.ts`), `test/` (`helpers/`, `fixtures/`, both dialects via `describe.each(dialects)`), `example/` and `docs/orchestraude/`. Check each against the tree.
  4. Design principles:
     - Drizzle column internals are read only in `src/introspect/`, and queries are built only in `src/data/` (the rest works on `ModelMeta`). Today `src/types.ts` and `src/admin.ts` import only the `Table` type from `drizzle-orm`, and the wording must allow that;
     - no frontend build: Hono JSX on the server, CSS and the one script as TS string modules in `src/static/`;
     - every UI string lives in `src/messages.ts` (glyph-only literals exempt, decision 033 item 11);
     - only `createAdmin` and the public types are exported from `src/index.ts`.
  5. Security rules:
     - `Location` headers are path-only and stay under the prefix;
     - post-login targets go through `safeNext`;
     - every POST passes the Origin check and the `_csrf` token check;
     - cookies are signed, HttpOnly, SameSite=Lax, and Secure per `isSecure`, and set and delete use the same attributes;
     - raw DB error messages are never rendered or logged (`describeForLog`);
     - output is escaped by JSX (no raw HTML);
     - values the user may not see are not rendered (decision 034 FK labels, decision 037 password values).
     Check each rule against the code as it is after task 36.
  6. Where things live:
     - design: `docs/orchestraude/drizzle-admin/03-design/` (start at `README.md`);
     - decisions: `docs/orchestraude/decisions/`;
     - evidence: `docs/orchestraude/evidence/`;
     - accepted low findings and adopted conventions: `docs/orchestraude/review-policy.md`;
     - task files: `docs/orchestraude/drizzle-admin/tasks/`.
  7. Workflow for agents:
     - do not commit, push or rewrite history unless asked;
     - delete files with `gio trash`, not `rm`;
     - a change that departs from the design needs a decision record first;
     - record any export or prop not in the design in the task History (already a convention; a one-line pointer is enough);
     - do not re-raise items listed in `review-policy.md`.
  8. Conventions: the existing section, unchanged.
- Every path, command and environment variable in the file must exist in the repository as it is when this task runs.

## Definition of Done
- [ ] `git diff CLAUDE.md` shows no removed or changed line among the `## Conventions` heading and its six bullets.
- [ ] CLAUDE.md has at most 80 lines.
- [ ] CLAUDE.md contains each of these strings: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `scripts/verify.sh`, `pnpm example`, `127.0.0.1`, `src/introspect`, `src/data`, `src/messages.ts`, `safeNext`, `docs/orchestraude/decisions/`, `docs/orchestraude/evidence/`, `docs/orchestraude/review-policy.md`, `docs/orchestraude/drizzle-admin/03-design/`, `gio trash`, and a sentence that says not to commit.
- [ ] Every file path named in CLAUDE.md exists (list the paths you checked in History).
- [ ] Tests: none added (documentation only). The existing suite still passes.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/README.md (components, source layout, error-handling rules)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md (section "API (commands)")
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/example.md (section "`example/server.ts`")
- Policy: docs/orchestraude/review-policy.md
- Decisions: docs/orchestraude/decisions/033-low-findings-recorded-behaviors.md (item 11), docs/orchestraude/decisions/034-fk-reference-view-permission.md, docs/orchestraude/decisions/037-password-widget-no-echo.md

## History
