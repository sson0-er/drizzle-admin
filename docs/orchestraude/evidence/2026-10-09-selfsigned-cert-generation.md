---
id: 2026-10-09-selfsigned-cert-generation
question: Can a localhost test certificate (SAN localhost + 127.0.0.1) be generated in Node without openssl, and what does it cost?
source: npm view selfsigned; selfsigned 5.5.0 README; local install and run (Node v24.21.0)
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- selfsigned 5.5.0: MIT, engines node >=18, async-only generate(attrs, options). Deps @peculiar/x509 ^1.14.2 (MIT, node >=20) and pkijs ^3.3.3 (BSD-3-Clause); clean install is 23 packages, 8.3 MB on disk.
- generate([{name:"commonName",value:"localhost"}], {keyType:"ec", algorithm:"sha256", notAfterDate, extensions:[{name:"basicConstraints",cA:false},{name:"subjectAltName",altNames:[{type:2,value:"localhost"},{type:7,ip:"127.0.0.1"}]}]}) returned {private, public, cert, fingerprint} in 12-21 ms. openssl x509 -text confirmed ecdsa-with-SHA256, SAN DNS:localhost + IP:127.0.0.1, CA:FALSE. A non-CA self-signed leaf was accepted as a trust anchor via NODE_EXTRA_CA_CERTS (see 2026-10-09-extra-ca-certs-flow). The default algorithm is sha1, so pass algorithm: "sha256".
- The pre-generated alternative (a committed key and cert under example/) was not tried: a committed PEM private key will be flagged by secret scanners (general knowledge, unverified here) and the cert expires.
Not confirmed: node:crypto-only X.509 building (no built-in certificate API known; not checked); generation on Node 22.
