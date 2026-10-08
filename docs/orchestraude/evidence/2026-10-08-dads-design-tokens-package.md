---
id: 2026-10-08-dads-design-tokens-package
question: What does @digital-go-jp/design-tokens contain (color, font, radius, spacing, dark mode) and what are its version/license?
source: npm view and tarball of @digital-go-jp/design-tokens 2.0.1 (modified 2026-05-28); https://github.com/digital-go-jp/design-tokens; snippets repo src/global.css
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- npm @digital-go-jp/design-tokens 2.0.1, MIT, files: dist/tokens.css (9.5 KB), dist/tokens-simple.css (colors, fonts, elevation only), tokens.js, tokens.d.ts. Generated from Figma via Tokens Studio and Style Dictionary.
- CSS custom properties on :root: primitive palettes `--color-primitive-{blue,light-blue,cyan,green,lime,yellow,orange,red,magenta,purple}-{50..1200}`, neutral `--color-neutral-white/black`, `--color-neutral-solid-gray-{50..900}` (incl. 420 and 536), opacity grays, semantic `--color-semantic-success-1/2` (green-600/800), `error-1/2` (red-800/900), `warning-yellow-1/2`, `warning-orange-1/2`, key color `--color-key-{50..1200}` mapped to blue.
- Key values: blue-900 #0017c1, blue-1000 #00118f, red-800 #ec0000, red-900 #ce0000, green-800 #197a4b, solid-gray-536 #767676, gray-600 #666666, gray-800 #333333, gray-50 #f2f2f2, yellow-300 #ffd43d.
- Typography tokens: `--font-family-sans: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif`; `--font-family-mono: 'Noto Sans Mono', monospace`; weights 400/700 only; sizes 14,16,17,18,20,22,24,26,28,32,36,45,48,57,64 px; line heights 1.0-1.75. Body text pattern: 16px / 1.7 / letter-spacing 0.02em; dense 14-16px / 1.2-1.3.
- Radius tokens (tokens.css only): 4, 6, 8, 12, 16, 24, 32px and full. Elevation 1-8 box-shadows. There are NO spacing tokens; components hard-code px/rem values (4, 8, 12, 16, 24 ...).
- No dark-mode tokens: grep for "dark" in the tokens tarball found nothing. In the snippets repo only modal-dialog uses `color-scheme` (backdrop). No `prefers-color-scheme` anywhere in snippets src.
- The system font stack has no system Japanese font (-apple-system, BlinkMacSystemFont, sans-serif only): without Noto Sans JP, Windows falls back to the browser default sans-serif, usually Yu Gothic/Meiryo; this last point is general knowledge, unverified.
Not confirmed: whether the DADS website guidelines state a permitted fallback stack or explicitly say dark mode is out of scope.
