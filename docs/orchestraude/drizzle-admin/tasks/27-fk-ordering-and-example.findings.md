# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] list.test.ts rebuilds an admin inline instead of reusing a helper
  - location: test/list.test.ts:383
  - detail: The FK filter ordering test builds a full createAdmin config (secret, auth, verifyCredentials) inline, duplicating what makeAdmin in test/helpers/app.ts does. The form test uses adminOn for the same job. Consider adding the same kind of helper option for list tests. Small duplication is acceptable under the project convention, so this is style only.
  - evidence: (none)
- [security] Empty HOST binds the demo to all interfaces
  - location: example/server.ts:10
  - detail: `process.env.HOST ?? "127.0.0.1"` keeps an empty string (e.g. `HOST=` exported by a shell or .env template). @hono/node-server passes it to `server.listen(port, "")`, and Node treats a falsy host as unspecified, so the demo (default password "admin") listens on all interfaces while printing `http://:3000/admin/`. Use `process.env.HOST || "127.0.0.1"` so an empty value falls back to loopback.
  - evidence: (none)
- [tests] Form test falls back to the whole document when the select is missing
  - location: test/form.test.ts:189
  - detail: `qsa(select ?? doc, ...)` hides a missing select element: the failure would show a wrong option list instead of pointing at the absent select. Assert that `select` is not null first, or use a non-null assertion with a short comment.
  - evidence: (none)
- [tests] List test builds a full createAdmin config inline
  - location: test/list.test.ts:395
  - detail: The auth and secret setup repeats what the helper in test/helpers/app.ts does. This is acceptable for one use, but a short helper or an extra option on makeAdmin would make the intent (only the authors ordering differs) clearer.
  - evidence: (none)

