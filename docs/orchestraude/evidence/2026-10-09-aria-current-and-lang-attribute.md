---
id: 2026-10-09-aria-current-and-lang-attribute
question: For decision 051, may the language switcher mark the active language with aria-current on a button, and give each language name its own lang attribute?
source: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current ; https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `aria-current` is usable in all roles except `gridcell`, `option`, `row` and `tab` (those use `aria-selected`), so a `<button>` may carry it. `aria-current="true"` means "the current item in a set"; `false` is the default.
- MDN contrasts "current" with "selected" (tabs use `aria-selected`); toggle buttons use `aria-pressed`.
- `lang` is a global attribute valid on any element; it lets screen readers pick the right pronunciation, inherits from `<html lang>` and can be overridden per element (WCAG 3.1.1 page language, 3.1.2 language of parts).
Not confirmed: how individual screen readers announce `aria-current="true"` on a button.
