# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] expectPage parameter shadows imported text
  - location: scripts/smoke/consumer.ts:13
  - detail: The optional parameter `text` shadows the `text` column helper imported from drizzle-orm/sqlite-core, and `fetch` shadows the global. Rename to `expected` and `handler`. The `(req) => app.fetch(req)` wrappers could also be passed as `app.fetch.bind(app)` or the parameter typed to take the app itself.
  - evidence: (none)
- [spec] Tarball-count failure message misreports the zero-tarball case
  - location: scripts/smoke-pack.sh:28
  - detail: Without nullglob, when no .tgz exists `tarballs` holds the literal pattern, so the check fails through `! -f` but the message says `found 1`. The task asks that every failure message name the problem. This is practically unreachable because a failed `npm pack` already exits under `set -e`. One fix is to print a separate message when `${tarballs[0]}` is not a file, e.g. `no tarball in $work`.
  - evidence: (none)
- [tests] ts-expect-error can pass for the wrong reason
  - location: scripts/smoke/consumer.ts:75
  - detail: The expect-error line also sets slug: "typecheck", so it would stay satisfied if only the slug option errored, even when listDisplay stopped being typed. The one-off negative run in the DoD only shows it fails once the directive is removed. Dropping slug from that call (items is registered once already) pins the check to listDisplay.
  - evidence: (none)
- [tests] Tarball check does not require the published type declarations
  - location: scripts/smoke-pack.sh:36
  - detail: The required entries are src/index.ts and dist/index.js only. The consumer's tsc run would catch a missing .d.ts indirectly, but a missing dist/index.d.ts would then show up as a confusing tsc error. Adding package/dist/index.d.ts to the list gives a direct failure message.
  - evidence: (none)
- [tests] Postgres list page asserted without registering a custom option; sqlite root page has no content check
  - location: scripts/smoke/consumer.ts:50
  - detail: The index page /admin/ is checked for status 200 only, in both dialects. A broken index that still returns 200 would pass. Passing a model label as the text argument would make the check meaningful.
  - evidence: (none)

