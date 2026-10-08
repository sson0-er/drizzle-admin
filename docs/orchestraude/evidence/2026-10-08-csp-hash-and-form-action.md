---
id: 2026-10-08-csp-hash-and-form-action
question: For decision 044, how do CSP script hashes work for an inline script, and does form-action apply to redirects after a form submission?
source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `script-src 'sha256-<base64>'` allows an inline `<script>` whose contents (not the tags) hash to that value; whitespace and case matter. Hash sources are Baseline "widely available" since 2016-08.
- `form-action` takes `'none'` or a source list (`'self'`, host sources, scheme sources).
- Whether `form-action` blocks redirects after a form submission is debated; MDN: Chrome 63 blocks such redirects, Firefox 57 does not.
Not confirmed: current Chrome/Firefox/Safari behavior for a cross-origin redirect after a POST under `form-action 'self'` (only the MDN note above); whether the automatic `/favicon.ico` request is reported under `default-src 'none'`.
