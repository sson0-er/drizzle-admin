---
id: 2026-10-08-icon-color-contrast
question: For decision 039 (UI icons), do the proposed icon colors reach at least 3:1 contrast (WCAG non-text contrast) on the admin.css backgrounds in light and dark mode?
source: local node script implementing the WCAG 2.x relative-luminance contrast formula, run 2026-10-08 against the colors in src/static/admin-css.ts
fetched: 2026-10-08
expires: 2027-01-06
---
Learned (contrast ratios, computed):
- Light: success `#2e7d32` on `#fff` 5.13, `#f9f9f9` 4.87, `#ffc` 4.99, `#dfd` 4.74. Warning `#8a6d00` on `#ffc` 4.79, `#fff` 4.92. Error (existing `--error-fg` `#ba2121`) on `#fff` 6.31, `#f9f9f9` 5.99, `#ffc` 6.14, `#ffefef` 5.66.
- Dark: success `#81c784` on `#121212` 9.31, `#1b1b1b` 8.56, `#3d3a1a` 5.74, `#1e3a24` 6.19. Error (existing dark `--error-fg` `#ff8a80`) on `#121212` 8.21, `#1b1b1b` 7.55, `#3d3a1a` 5.06, `#3b1d1d` 6.67. Warning `#f5dd5d` on `#3d3a1a` 8.46.
- All pairs exceed 3:1 (and 4.5:1).

Not confirmed:
- No check in forced-colors / high-contrast mode; selected-row and hover backgrounds other than those listed were not computed.
