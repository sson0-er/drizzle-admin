---
id: 2026-10-08-hono-jsx-inline-svg
question: For decision 039 (UI icons), can Hono JSX render static inline SVG (svg/path with viewBox and stroke attributes) without raw(), and does it type-check?
source: node_modules/hono 4.13.13 dist/jsx/base.js (jsxFn, toStringToBuffer, toSVGAttributeName), dist/jsx/utils.js, dist/types/jsx/intrinsic-elements.d.ts
fetched: 2026-10-08
expires: 2027-01-06
---
Learned (code reading, hono 4.13.13):
- `jsxFn` treats `svg` specially: it wraps the children in a namespace context with value `"svg"`, so attributes of `svg` and its descendants go through `toSVGAttributeName`.
- `toSVGAttributeName` turns selected camelCase keys into kebab-case (e.g. `strokeWidth` → `stroke-width`, `strokeLinecap` → `stroke-linecap`); `viewBox` does not match its prefix list and is emitted unchanged. Kebab-case keys written directly pass `isValidAttributeName` and are emitted as written.
- Attribute values are escaped by the normal JSX path; no `raw()` or `dangerouslySetInnerHTML` is needed for static `svg`/`path` elements.
- The JSX typings declare `[tagName: string]: Props` on `IntrinsicElements`, and there is no specific `svg` entry, so `<svg>` / `<path>` with any attributes type-check.

Not confirmed:
- The exact serialized form of `<path ... />` (self-closing or with an end tag) was not run; either form parses the same in HTML foreign (SVG) content.
