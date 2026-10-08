---
id: 52-i18n-docs
depends_on: [49-i18n-dictionaries-and-request-locale, 50-language-switch-route, 51-language-switcher-ui]
status: done
attempts: 0
---
# Task 52: i18n-docs

## Goal
Internationalization, part 4 (documentation, decisions 049-051):
- README.md describes the English default, the switcher, the `da_lang` cookie, the reserved slug `_lang` and the per-language `siteTitle` default. It no longer says the UI is Japanese only.
- CHANGELOG.md `## Unreleased` → `### Changed` lists the language change.
- CLAUDE.md states the new project rules from the design README section "Project rules affected". The user approved this CLAUDE.md edit for this round.

## Scope
### Files to touch
- README.md
- CHANGELOG.md
- CLAUDE.md
- test/readme.test.ts (new cases only)

### Do not touch
- src/**, example/**, every test file other than test/readme.test.ts
- The 12-heading list asserted by test/readme.test.ts ("has the 12 outline sections ..."): do not add a `##` heading, and do not edit that assertion
- CLAUDE.md sections other than "Overview", "Layout", "Design principles" and "Security rules". "Conventions" and "Workflow for agents" stay verbatim.
- package.json, biome.json, vitest.config.ts
- docs/** (except this task's History)
- Do not commit.

## Implementation notes
Write in English. Describe the behavior as implemented in tasks 49-51; read the code where the wording depends on it (e.g. the English texts in src/messages.ts).

- **README.md** (project-setup.md README outline, the "Changed 2026-10-09: internationalization" paragraph), by section:
  - 1 "What it is": the feature list says "English and Japanese UI" (replace the "Japanese only" bullet at line 15 as of commit 2a80a06).
  - 5 "Configuration reference": the `siteTitle` row's default is "Site administration" (English) / "サイト管理" (Japanese), following the visitor's language. A configured title is not translated.
  - 6 "Model options reference": the `slug` row lists `login`, `logout`, `static` and `_lang` as reserved.
  - 8 "Authentication modes and security", "Cookies" table: add a `da_lang` row (unsigned, value `en` or `ja`, one year). Extend the sentence below the table so it is clear that `da_lang` uses the same `Path` / `HttpOnly` / `SameSite` / `Secure` rules, is not signed and is not a security cookie.
  - New `### Language` subsection at the end of section 8, after "Deploying behind a reverse proxy" and before `## Behavior notes`. Planner decision: the design says "New section 'Language' after 8", but test/readme.test.ts pins exactly 12 `##` headings and that assertion is not on the allowed-edit list. A `###` placed last in section 8 keeps the order and leaves the test unchanged; task 48 handled the Changelog pointer the same way. Content:
    - English is the default for every visitor;
    - the header switcher ("English / 日本語", a POST form that works without JavaScript, also on the login page) stores the choice in `da_lang` for one year per browser and per `basePath`;
    - `Accept-Language` is not used, and there is no option to change the default;
    - model labels, field names, action labels, `toString` and formatter output, `validate` messages, an action's returned message and a configured `siteTitle` are shown as written;
    - configuration errors and log lines are English;
    - dates and numbers use the same format in both languages.
  - 10 "Known limitations": replace "The user interface is Japanese only." with "English and Japanese only; the default language (English) cannot be configured."
- **CHANGELOG.md** (project-setup.md "CHANGELOG.md", the 2026-10-09 paragraph): under `## Unreleased` → `### Changed`, add:
  - **The UI is English by default.** Japanese is available from the "English / 日本語" switcher in the header and on the login page, remembered per browser in the `da_lang` cookie for one year. Existing Japanese-speaking users switch once.
  - The default `siteTitle` follows the language ("Site administration" / "サイト管理").
  - The model slug `_lang` is now reserved (`register()` throws for it); `lang` stays valid.
- **CLAUDE.md** (design README.md "Project rules affected (Changed 2026-10-09, decision 049 point 12)", the canonical text; copy its meaning into the existing bullets, keeping their style):
  - Overview: "Japanese UI" → "English (default) and Japanese UI".
  - Layout: the `src/messages.ts` entry says it holds the UI strings per locale (`en`, `ja`) and the locale helpers; `src/auth/` also holds the locale cookie; `src/routes/` also holds the language switch.
  - Design principles: replace the "Every UI string lives in `src/messages.ts`" bullet with the README text: both dictionaries, a missing key fails typecheck; code takes texts from the request's dictionary (`c.var.t` in routes, the `t` prop or argument in views and forms), never from a module-level import or constant; user-provided labels are not translated; glyph-only literals are exempt (decision 033 item 11) and the language names live in `LOCALE_NAMES`; developer-facing errors and log lines are English and stay out of the dictionaries.
  - Security rules: the cookie bullet gains "except `da_lang`, an unsigned preference validated against the locale allow-list on read (decision 050); it still uses `cookieAttrs`". The `Location` bullet names the language switch next to the post-login target as a `safeNext` user.
  - If the permission system refuses the CLAUDE.md edit, finish the rest of the task and report this item as blocked.
- **test/readme.test.ts**, new cases only:
  - the `### Language` subsection exists, and its body (up to the next `##`/`###` heading) contains `da_lang`, `Accept-Language` and `English`;
  - the "Known limitations" section body contains `English and Japanese only`;
  - the README contains `` `_lang` ``.

  The first two fail on the current README; record this in History.

## Definition of Done
- [ ] README.md: section 1 mentions English and Japanese; the `siteTitle` row names both defaults; the `slug` row lists `_lang`; the Cookies table has a `da_lang` row; a `### Language` subsection is the last subsection of "Authentication modes and security"; "Known limitations" no longer contains "The user interface is Japanese only."
- [ ] `grep -c "^## " README.md` is unchanged from before the task (12 `##` headings in the same order; checked by the existing test).
- [ ] CHANGELOG.md `### Changed` under `## Unreleased` has the three new bullets; the existing bullets are unchanged.
- [ ] CLAUDE.md: Overview, Layout, Design principles and Security rules carry the four changes from the design README "Project rules affected"; `git diff CLAUDE.md` touches no other section.
- [ ] Tests (test/readme.test.ts): the three new cases pass; `git diff test/readme.test.ts` has no removed lines.
- [ ] History records that the new readme cases failed before the README edit, and the `###` placement decision.
- [ ] `git diff --name-only` lists only the files in "Files to touch" and this task file.
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md#CHANGELOG.md (decision 048) (2026-10-09 paragraph)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/project-setup.md#README.md outline (written in phase 6; English) ("Changed 2026-10-09: internationalization")
- Design: docs/orchestraude/drizzle-admin/03-design/README.md#Project rules affected (Changed 2026-10-09, decision 049 point 12)
- Design: docs/orchestraude/drizzle-admin/01-requirements.md (Scope, 2026-10-09 note)
- Decisions: docs/orchestraude/decisions/049-i18n-message-dictionaries.md (points 6-8, 12), docs/orchestraude/decisions/050-locale-cookie.md, docs/orchestraude/decisions/051-language-switcher-post-form.md
- Conventions: CLAUDE.md "Conventions"; docs/orchestraude/review-policy.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)

- Attempt 1: done. README.md, CHANGELOG.md and CLAUDE.md updated as specified; three cases added to test/readme.test.ts (no removed lines). Before the README edit all three new cases failed (the `### Language` case, the "English and Japanese only" case and, additionally, the `_lang` case, since the README did not mention `_lang`). The `### Language` subsection is a `###` placed last in section 8 (before `## Behavior notes`) so the 12-`##` heading assertion stays unchanged, as the planner decided. No exports or props added.
- Review round 1: high 0, medium 0, low 2 (quality and tests: the Language subsection test loops inside one it instead of it.each). Done.
