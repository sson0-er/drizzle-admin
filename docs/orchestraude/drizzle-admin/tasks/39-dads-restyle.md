---
id: 39-dads-restyle
depends_on: [38-ui-icons]
status: pending
attempts: 0
---
# Task 39: dads-restyle

## Goal
The admin stylesheet `ADMIN_CSS` is rewritten as the DADS-inspired restyle of decision 040 (a post-v1 enhancement the user requested):
- 28 color tokens in the light `:root` block and the dark `:root` block;
- 16px / 1.7 body typography, 48px controls with 8px radius, and a denser 14px table;
- solid / outline / text / danger button variants chosen by existing selectors;
- card-style flash messages;
- a black/yellow focus ring whose colors swap in dark mode.

The rules are views-style.md. Only the stylesheet string and the comment above it change. Markup, selectors, messages and test hooks stay as they are. `ADMIN_CSS_VERSION` changes by itself. A new `test/admin-css.test.ts` pins tokens, contrast, focus and shapes.

## Scope
### Files to touch
- src/static/admin-css.ts: only the `ADMIN_CSS` template string and the comment directly above `export const ADMIN_CSS`
- test/admin-css.test.ts (new)

### Do not touch
- In `src/static/admin-css.ts`: the `fnv1a` function, its comment and the `ADMIN_CSS_VERSION` line. The exports stay exactly `ADMIN_CSS` and `ADMIN_CSS_VERSION`.
- src/views/**, src/forms/**, src/messages.ts, src/static/select-all.ts, src/routes/**, src/index.ts, and any other file under `src/`. Add no class, id, `name`, `data-*` or `aria-*` attribute to markup. Add no "required" marker (Q11 is open; the design default is to leave it out).
- Every existing test file, including test/views.test.ts and test/helpers/**. The new test keeps its helpers (`block`, `tokens`, `contrast`) local to `test/admin-css.test.ts`.
- biome.json, package.json, pnpm-lock.yaml, tsconfig*, vitest.config.ts, scripts/**. Add no `biome-ignore` comment.
- README.md (decision 040: no README mention), CLAUDE.md, example/**
- docs/** (except this task's History)
- Token values and selector lists given in views-style.md. If a test from test-strategy.md fails against the design values (for example, a contrast pair below its threshold), do not change the value, the pair list or the threshold. Stop and report blocked with the computed numbers.
- Do not commit.

## Implementation notes
- **Source of truth.** docs/orchestraude/drizzle-admin/03-design/interfaces/views-style.md is normative for tokens, rules and order. The "CSS requirements" paragraph and the decision 039 icon rules in views.md ("Static modules") still hold.
- **Comment.** Put the attribution comment of views-style.md "Attribution comment" directly above `export const ADMIN_CSS`, outside the template string. Write it as consecutive `//` lines. Joined with single spaces, the lines read exactly:
  `Colors and sizes are inspired by the public token values of the Digital Agency design system (DADS, @digital-go-jp/design-tokens 2.0.1, MIT). This stylesheet is our own work; it is not part of DADS and is not made or endorsed by the Digital Agency.`
  You may keep the existing decision-007 comment ("Stylesheet as a string module …") above the attribution lines; update its wording if it no longer fits. The served CSS (the string) must not contain `DADS`, `dads` or `Digital Agency`.
- **Layout of the string, top to bottom:**
  1. The light `:root` block: all 28 tokens of the views-style.md "Tokens" table with the Light values, plus `color-scheme: light dark;`.
  2. `@media (prefers-color-scheme: dark) { :root { … } }` with all 28 tokens and the Dark values. It also redefines tokens whose dark value equals the light one, such as `--focus-fill`. It may stay directly after the light block, as now.
  3. The rules of "Reference rules", group by group.
  4. The decision 039 icon rules from views.md, verbatim.
  5. The focus ring rules.
  6. `@media (max-width: 767px) { … }` last.
  Keep the two media query strings byte-for-byte as written.
- **Tokens.** Write every value as lowercase 6-digit hex (`#ffffff`, not `#fff`). Remove every v1 token that is not in the table (`--secondary`, `--accent`, `--header-bg`, `--row-alt`, `--button-bg`, `--delete-bg`, `--success-bg`, …). No v1 palette value may remain (`#417690`, `#79aec8`, `#447e9b`, `#ba2121`, `#264b5d`).
- **Rules.** Copy the selector lists exactly as shown in views-style.md, including the single space before `{`, because tests search for these strings. Inside a declaration block you may change line breaks and merge identical declarations.
  - Keep the "order:" constraints: the input hover rule comes after the input rule; the `.errorlist + input, …` rule comes after the hover rule.
  - Focus rules come after every other rule and before `@media (max-width: 767px)`. The plain `:focus-visible {` rule must come before `:is(a, #header button):focus-visible {`. Both strings contain `:focus-visible {`, and the tests use the first occurrence.
  - The `body` rule carries the full typography of views-style.md "Typography" (the font stack exactly as written).
  - Use only font weights 400 and 700.
  - Add no `transition`, `animation`, `outline: none`, `outline: 0`, `:focus {` rule, `url(`, `@import`, `@font-face` or `http`.
  - The template string must not contain a backtick or `${`.
- **Removed v1 rules.** Remove the v1 rules that views-style.md replaces or drops, for example `#header a`, the uppercase `#header button`, `.breadcrumbs a`, the `thead th` fill and `thead th a`. The `.icon`, `.boolean-mark …`, `.messagelist .success|.error|.warning .icon` and `.visually-hidden` rules of decision 039 stay as they are.
- **`test/admin-css.test.ts`.** Follow test-strategy.md "Restyle (decision 040)" bullet by bullet. Import only `ADMIN_CSS` from `../src/static/admin-css.js` and `vitest`. Define the local helpers:
  - `block(css, start)`: the brace-balanced text inside the braces after the first occurrence of `start`. Throw when `start` is absent.
  - `tokens(blockText)`: a `Map` of every `--name: value;` declaration.
  - `contrast(a, b)`: the WCAG 2.x ratio from relative luminance with sRGB linearization, threshold 0.04045.
  - `light` = `tokens(block(ADMIN_CSS, ":root"))`. `dark` = `tokens(block(block(ADMIN_CSS, "@media (prefers-color-scheme: dark)"), ":root"))`, or the equivalent.
  - The "text-input rule" is the block starting at `input[type=text], input[type=password]`. The button rule is the block starting at `button, .button, .object-tools a.addlink {`.
- Record in History every deviation from a views-style.md declaration (there should be none) and every merged or reordered group.

## Definition of Done
- [ ] Scope:
  - `git status --porcelain` lists only `src/static/admin-css.ts`, `test/admin-css.test.ts` and this task file;
  - `git diff --quiet -- test/ src/views src/forms src/messages.ts src/index.ts README.md CLAUDE.md` succeeds (test/admin-css.test.ts is untracked, so it does not count);
  - in `git diff src/static/admin-css.ts`, every changed line lies inside the `ADMIN_CSS` template string or in the comment lines directly above `export const ADMIN_CSS`. The `fnv1a` function and the `export const ADMIN_CSS_VERSION: string = fnv1a(ADMIN_CSS);` line are unchanged.
- [ ] Attribution: the `//` comment lines directly above `export const ADMIN_CSS`, joined with single spaces, contain the exact sentence quoted in Implementation notes. `ADMIN_CSS` matches neither `/dads/i` nor `/digital agency/i`. `README.md` is unchanged.
- [ ] `grep -nE "font-weight: (100|200|300|500|600|800|900)|transition|animation" src/static/admin-css.ts` finds nothing.
- [ ] Tests: `test/admin-css.test.ts` (new) covers every bullet of test-strategy.md "Restyle (decision 040)" except Regression and Manual:
  - Structure:
    - `ADMIN_CSS.indexOf(":root") < ADMIN_CSS.indexOf("@media")`;
    - the light block contains `color-scheme: light dark`;
    - `light` and `dark` each have exactly the 28 token names of the views-style.md table (asserted as sorted arrays equal to one literal list), and the two sets are equal;
    - every value in both maps matches `/^#[0-9a-f]{6}$/`.
  - Pinned values (it.each over scheme): `--primary` light `#0017c1` / dark `#9db7f9`; `--focus-outline` `#000000` / `#ffd43d`; `--focus-halo` `#ffd43d` / `#000000`; `--focus-fill` `#ffd43d` in both; `--danger` `#ce0000` / `#ff7171`; `--body-bg` `#ffffff` / `#1a1a1a`.
  - Contrast:
    - the helper self-check: `contrast("#000000", "#ffffff")` is 21, and `contrast("#767676", "#ffffff")` rounds to 4.54;
    - it.each over scheme × pair: every text pair listed in test-strategy.md is at least 4.5 and every non-text pair is at least 3;
    - the pair lists in the test match test-strategy.md one to one (no pair dropped, none added).
  - Typography:
    - the `body {` block contains `font-size: 16px`, `line-height: 1.7` and `letter-spacing: 0.02em`;
    - its `font-family` value starts with `"Noto Sans JP"`, contains `"Hiragino Sans"`, `"Yu Gothic UI"`, `Meiryo` and `system-ui`, and ends with `sans-serif`;
    - the `table {` block contains `font-size: 14px`.
  - Focus:
    - the `:focus-visible {` block contains `outline: 4px solid var(--focus-outline)`, `outline-offset: 2px` and `box-shadow: 0 0 0 2px var(--focus-halo)`;
    - `ADMIN_CSS` contains `:is(a, #header button):focus-visible`;
    - `indexOf(":focus-visible {")` is greater than `lastIndexOf` of each of `a.deletelink:hover`, `.paginator a:hover`, `#changelist-filter .selected a` and `.site-title:hover`, and less than `indexOf("@media (max-width: 767px)")`;
    - `ADMIN_CSS` does not match `/outline:\s*(none|0)/`.
  - Shapes:
    - `.messagelist li {` contains `border: 3px solid` and `border-radius: 12px`;
    - `.errornote {` contains `border-radius: 12px`;
    - the text-input block and the `button, .button, .object-tools a.addlink {` block each contain `border-radius: 8px` and `min-height: 48px`.
  - Variant selectors (it.each), each contained in `ADMIN_CSS`: `#changelist-search button`, `button[name=index]`, `button[name=_addanother]`, `button[name=_continue]`, `#header button`, `.submit-row a:not(.deletelink)`, `#delete-form button[type=submit]`, `form.delete-action button[type=submit]`, `a.deletelink`, `.paginator .this-page`, `.errorlist + input`.
  - Exclusions:
    - `ADMIN_CSS` contains none of `url(`, `@import`, `@font-face`, `http`, `.dads-` and `--color-primitive-`;
    - it contains none of the v1 values `#417690`, `#79aec8`, `#447e9b`, `#ba2121` and `#264b5d`;
    - it matches neither `/dads/i` nor `/digital agency/i` (the attribution stays in the TS comment only).
- [ ] Regression: every existing test passes without modification, including the CSS cases in test/views.test.ts (required areas, no `url(`, dark `:root`, 767px block with `#changelist-filter { … order: -1 }` and no `float: right`, `overflow-x: auto`, `--icon-success` / `--icon-warning` as 6-digit hex in both schemes, `.icon {`, `.boolean-mark[data-bool=true|false]`, `.visually-hidden {`, `ADMIN_CSS_VERSION` 8 hex chars, the stylesheet link `?v=`).
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm build` pass (part of scripts/verify.sh).
- [ ] History records that the manual browser check of test-strategy.md "Restyle" → "Manual" was not done by the implementer (未確認, for the user).
- [ ] scripts/verify.sh passes

## References
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views-style.md (whole file)
- Design: docs/orchestraude/drizzle-admin/03-design/interfaces/views.md (section "Static modules": exports, CSS requirements, decision 039 icon rules)
- Design: docs/orchestraude/drizzle-admin/03-design/test-strategy.md (section "Restyle (decision 040)"; views row of the "Per component" table)
- Design: docs/orchestraude/drizzle-admin/03-design/questions.md (Q11, open; no required marker in this task)
- Decisions: docs/orchestraude/decisions/040-dads-inspired-restyle.md, docs/orchestraude/decisions/007-static-assets.md
- Evidence: docs/orchestraude/evidence/2026-10-08-dads-restyle-palette-contrast.md, docs/orchestraude/evidence/2026-10-08-dads-a11y-focus-contrast.md, docs/orchestraude/evidence/2026-10-08-dads-license-notices.md, docs/orchestraude/evidence/2026-10-08-dads-html-snippets-repo.md, docs/orchestraude/evidence/2026-10-08-dads-design-tokens-package.md

## History
(Append one entry per attempt: attempt number, outcome, main findings.)
