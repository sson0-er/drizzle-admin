---
id: 2026-10-08-biome-no-svg-without-title
question: For decision 039 (UI icons), does Biome's recommended rule set reject an inline <svg> without <title>, and are decorative aria-hidden SVGs exempt?
source: https://biomejs.dev/linter/rules/no-svg-without-title/ (current docs); installed @biomejs/biome 2.5.15
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `lint/a11y/noSvgWithoutTitle` is a recommended rule (on by default), so it applies with the project's `"preset": "recommended"`.
- Valid forms: a non-empty `<title>` as the first child; `role="img"` with `aria-label` or `aria-labelledby`; or a decorative SVG marked `aria-hidden="true"` (or `role="presentation"`), which the rule ignores.

Not confirmed:
- The docs page describes the current release, not specifically 2.5.15. The implementation task confirms with `pnpm lint` that `aria-hidden="true"` written as a string literal on the `<svg>` element passes.
