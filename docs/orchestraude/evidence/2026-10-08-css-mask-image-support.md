---
id: 2026-10-08-css-mask-image-support
question: For decision 039 (UI icons), how widely is CSS mask-image supported (the alternative of CSS-only icons with data: URIs), and does a page CSP affect it?
source: https://developer.mozilla.org/en-US/docs/Web/CSS/mask-image ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/img-src ; https://w3c.github.io/webappsec-csp/
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `mask-image` is Baseline "widely available" since December 2023. Older Chrome and Safari versions need the `-webkit-mask-image` prefix, so a CSS-only icon set would declare every mask twice.
- CSP `img-src` governs image loads (the "image" destination).

Not confirmed:
- Whether `img-src` applies to `mask-image: url(data:...)` in a stylesheet, and whether `'self'` matches `data:` URLs. Neither MDN page nor the part of the CSP spec read says so. The rationale treats a host CSP blocking data: masks as a possible risk only ("unverified").
