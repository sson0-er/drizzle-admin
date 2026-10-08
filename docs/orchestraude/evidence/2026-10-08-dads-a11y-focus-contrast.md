---
id: 2026-10-08-dads-a11y-focus-contrast
question: What focus, forced-colors, reduced-motion and contrast conventions do the DADS snippets use?
source: snippets repo src/global.css, AGENTS.md, development-policy.mdx, button.css, input-text.css; contrast computed locally (WCAG relative luminance formula) from tokens in 2026-10-08-dads-design-tokens-package
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- Target: WCAG 2.2 A/AA and JIS X 8341-3:2016, axe-core tests, extra support for forced-colors, reduced motion and user font-size (rem units).
- Global focus ring (`:focus-visible`): 4px solid black outline, 2px offset, 4px radius, plus 2px yellow-300 (#ffd43d) box-shadow; text-type buttons and utility `dads-u-focus-outline` additionally fill the background yellow-300. Same ring repeated per component.
- Links: blue-1000 underlined (thickness 1px, 3px on hover), visited magenta-900, active orange-800; underline offset 3px. Hover styles guarded by `@media (hover: hover)`.
- Touch targets: sm/xs buttons add a 44px-tall ::after hit area.
- Disabled state uses colors only and `aria-disabled` for links; forced-colors: GrayText overrides.
- Icons: decorative `aria-hidden="true"`, meaningful `role="img"` + `aria-label`.
- Computed contrast on white: blue-900 11.1, red-800 4.6, red-900 5.79, gray-536 4.54, gray-600 5.74, gray-800 12.63, green-800 5.35, yellow-900 4.54; gray-420 (#949494, used as table border/disabled text) 3.03 on white and 2.71 on gray-50; black on yellow-300 14.74. Disabled-state contrast is below 4.5 by design (exempt under WCAG).
Not confirmed: the guideline pages' stated contrast targets (e.g. ratios chosen per role); behavior in real browsers (not rendered).
