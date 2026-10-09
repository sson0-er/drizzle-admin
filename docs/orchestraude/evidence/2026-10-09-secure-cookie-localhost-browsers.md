---
id: 2026-10-09-secure-cookie-localhost-browsers
question: Which browsers accept Secure cookies set over http://localhost?
source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie ; WebKit Bugzilla 232088 and 231035 (search result summary)
fetched: 2026-10-09
expires: 2026-11-08
---
Learned:
- MDN: "Insecure sites (http:) cannot set cookies with the Secure attribute. The https: requirements are ignored when the Secure attribute is set by localhost." (Chromium and Gecko behaviour; MDN excerpt did not name versions.)
- WebKit bug reports (232088, 231035): Safari does not accept Secure cookies from http://localhost although it treats localhost as a secure context. Current status of the bugs was not checked.
- The mock IdP's own cookies are Secure too; they are set by an https origin so they are unaffected.
- A self-signed certificate trusted by Node (NODE_EXTRA_CA_CERTS) is not trusted by browsers; a browser visiting https://localhost:<idp port> shows a certificate warning unless the cert is trusted in the OS/browser store (general behaviour, not tested in a browser).
Not confirmed: minimum Chrome/Firefox versions; Safari fix status; behaviour on Windows.
