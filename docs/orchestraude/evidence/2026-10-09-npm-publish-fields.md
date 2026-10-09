---
id: 2026-10-09-npm-publish-fields
question: For decision 052, which package.json fields control publish access, repository links and engines, and are peers installed automatically?
source: https://docs.npmjs.com/cli/v11/configuring-npm/package-json; https://docs.npmjs.com/cli/v11/using-npm/config (access); https://docs.npmjs.com/creating-and-publishing-scoped-public-packages; `npm config ls -l` (npm 11.19.0)
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- `publishConfig`: config values used at publish time (access included).
- `repository.url` form `git+https://github.com/<owner>/<repo>.git`; `bugs` takes a URL (used by `npm bugs`); `homepage` is a plain URL.
- `engines` is advisory (warnings only) unless `engine-strict` is set; npm 11.19.0 default `engine-strict = false`.
- Since npm 7, `peerDependencies` are installed by default.
- Contradiction: the npm 11 `access` config says the default is "public for new packages", while the scoped-packages guide says scoped packages are published private by default and need `npm publish --access public`. Local `access` default prints `null`.
Not confirmed: which of the two documented defaults the registry applies to a first scoped publish today; `publishConfig.access: "public"` makes it irrelevant.
