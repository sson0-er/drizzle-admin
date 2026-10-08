---
id: 2026-10-08-dads-html-snippets-repo
question: What is the DADS HTML example components repo built from, how is it maintained, and which components/JS does it have?
source: https://github.com/digital-go-jp/design-system-example-components-html cloned at commit af8b665 (tag v20260909); README.md, AGENTS.md, src/docs/development-policy.mdx, .storybook/preview-head.html, src/components/*
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- Plain HTML/CSS/JS snippets, framework independent, intended to be copied and modified; no CSS preprocessor, no cascade layers, BEM with `dads-` prefix, modifiers via data attributes (`data-type`, `data-size`), `rem` via `calc(px / 16 * 1rem)`. Styles use ARIA states (aria-invalid, aria-disabled).
- Node/npm repo only for Storybook 10, Vitest, Playwright VRT (checks rendering across reset CSS libs), Biome; runtime dependency list: @digital-go-jp/design-tokens ^2.0.1 (react only for docs). No bundle/dist is published; consumption = copy files.
- Maintenance: 352 commits, tags like v20260805, v20260825, v20260909 (latest, 2026-09-09); site v2.18.0 (beta, "β版"). PRs are not accepted; issues only. The site is labelled beta so markup/class names may change.
- Components present (40): accordion, blockquote, breadcrumb, button, calendar, card, carousel, checkbox, chip-label, date-picker, description-list, disclosure, divider, drawer, emergency-banner, file-upload, form-control-label, hamburger-menu-button, heading, horizontal-menu, image, input-text, language-selector, link, list, menu-list, menu-list-box, modal-dialog, notification-banner, page-navigation, progress-indicator, radio, resource-list, search-box, select, step-navigation, switch, tab, table, textarea, toc, utility-link. No site header/footer, no pagination with page numbers, no sidebar/filter, no error-summary component, no danger/destructive button variant.
- JS (custom elements, no Shadow DOM) exists only for: textarea-counter, table scroll-shadow, tab, switch, progress-indicator, menu-list-box, language-selector, date-picker, carousel, calendar, file-upload. Notification-banner close button has no bundled JS (markup only). Button, input-text, select, checkbox, radio, textarea (without counter), table, breadcrumb, notification-banner (without close), page-navigation markup, form-control-label are CSS-only.
- Every example HTML loads Noto Sans JP from fonts.googleapis.com (Google Fonts) and storybook preview does likewise; global.css only declares `--font-family-sans` and does not self-host.
- Button: data-type solid-fill / outline / text, data-size lg(56px)/md(48)/sm(36)/xs(28); colors from `--color-key-*` (blue); radius 8/8/6/4px; disabled via :disabled or aria-disabled; forced-colors handled.
- Input text: 1px solid gray-600 border, radius 8px, heights 40/48/56px, error via :user-invalid or aria-invalid=true -> border red-800, `.dads-input-text__error-text` in red-800. form-control-label has label, `data-required` "※必須" marker, support text and error text, fieldset/legend for groups.
- Notification banner: types success / error / warning / info-1 / info-2, styles standard / color-chip, inline SVG icon with role=img + aria-label (e.g. エラー), optional close button, optional actions; 3px border radius 12px.
- Table: `.dads-table` + `.dads-table__table`; options stripe (`data-row-stripe`), `data-size="dense"`, `data-cell-border`, sortable header, selectable, overflow-on-mobile (needs optional scroll-shadow.js). Cell padding 20/16px (12/16 dense).
- Page navigation is prev/next + "5 / 9,999" counter (buttons with data-control prev/next, JS-free markup but no behavior supplied); breadcrumb uses nav + visually-hidden label + SVG chevron separators.
Not confirmed: contents of site docs beyond the repo; per-component guideline pages on design.digital.go.jp.
