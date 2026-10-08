---
id: 2026-10-08-prepack-lifecycle
question: For decision 048, which lifecycle script runs on every pack and publish with npm and pnpm (prepack vs prepublishOnly)?
source: https://docs.npmjs.com/cli/v11/using-npm/scripts ; https://pnpm.io/cli/publish
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- npm: `prepack` runs before a tarball is packed on `npm pack`, `npm publish` and git-dependency installs. `prepublishOnly` runs only on `npm publish`. Publish order: prepublishOnly, prepack, prepare, postpack, publish, postpublish.
- pnpm: `pnpm publish` runs prepublishOnly, prepublish, prepack, prepare, postpack, publish, postpublish (the page lists them but does not state the order).
Not confirmed: that `pnpm pack` runs `prepack` (the pnpm page does not say).
