# Review findings

high: 0, medium: 1, low: 8

## high


## medium

- [03-design-review] TLS guard does not prove verification is active where the flow runs
  - location: docs/orchestraude/drizzle-admin/03-design/test-strategy.md
  - detail: tls-verification.test.ts only scans for three names and checks the inherited env in its own worker. The flow test would pass just the same with verification off by another route: a dispatcher or agent with `checkServerIdentity: () => undefined` (the obvious fix for a SAN mismatch), `strict-ssl=false` / `strictSsl: false` in `.npmrc` or `pnpm-workspace.yaml` (neither is scanned), `curl --insecure` in `scripts/` or `.github/`, or a name built by concatenation. Fix: add a behavioural negative control to example-oidc.test.ts, in the same worker as the flow. Generate a second certificate in the test with `selfsigned` (not the one in NODE_EXTRA_CA_CERTS), serve it from an `https.createServer` on 127.0.0.1:0, and assert that `fetch('https://localhost:<port>/')` rejects with a certificate error. That fails whatever mechanism disabled verification. Optionally also add `checkServerIdentity`, `strict-ssl`/`strictSsl` and `--insecure` to the scanned names, and `.npmrc`/`pnpm-workspace.yaml` to the scanned files. Decision 053 point 2 and the CLAUDE.md security line should mention the control.
  - evidence: 2026-10-09-extra-ca-certs-flow

## low

- [03-design-review] Example cannot refuse an inherited NODE_TLS_REJECT_UNAUTHORIZED=0
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md
  - detail: launch.ts passes `process.env` (real mode) or `{ ...process.env, ... }` (mock mode) to the child. A shell with NODE_TLS_REJECT_UNAUTHORIZED=0 therefore runs the demo with verification off, while the README says it is never turned off. The guard bans the name in `example/`, so the example cannot check for it. Consider a single exempted check (for example, `config.ts` throws when it is set, and the guard exempts that one occurrence), or drop the variable from the child env in the launcher. Otherwise, document the limitation.
  - evidence: (none)
- [03-design-review] Callback failure paths unspecified
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md
  - detail: The Errors section covers `getAuth` throws and misconfiguration. It does not say what `GET /oidc/callback` answers when the IdP returns `error=access_denied` (the user cancels consent), when the state, nonce or PKCE check fails, or when the state cookies are missing (expired or wrong host). State that these are the library's thrown HTTPException or 500 through Hono's default handler, with no custom page, so the implementer does not add handling the design did not ask for.
  - evidence: (none)
- [03-design-review] Real mode inherits the library's request-every-scope default
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md
  - detail: In real mode `OIDC_SCOPES` is left to the library, which requests every scope in the IdP's `scopes_supported` (evidence: 2026-10-09-hono-oidc-auth-package). For an example that users copy, that is broader than needed and may trigger consent for unrelated scopes. Consider defaulting real mode to `openid email` (plus `offline_access` if refresh is wanted), overridable by `OIDC_SCOPES`, and listing it in the configuration table.
  - evidence: 2026-10-09-hono-oidc-auth-package
- [03-design-review] Library env fallback makes tests and mock mode depend on the shell
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md
  - detail: Keys missing from `opts.oidc` fall back to `process.env` inside `@hono/oidc-auth`. A developer's shell values such as `OIDC_COOKIE_NAME`, `OIDC_COOKIE_PATH`, `OIDC_AUTH_EXTERNAL_URL` or `OIDC_AUDIENCE` therefore change the test app and the mock-mode demo. For example, a cookie path other than `/` produces a `/admin` <-> `/oidc/login` redirect loop. Consider having the global setup (or `makeApp`) fail when unexpected `OIDC_*` variables are present, or note it in the README.
  - evidence: 2026-10-09-hono-oidc-auth-package
- [03-design-review] Mode chosen by different variables in launcher and config
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md
  - detail: launch.ts picks real mode on `OIDC_ISSUER`, and config.ts picks mock mode on `OIDC_MOCK_CERT_DIR`. Running `tsx example/oidc/server.ts` directly gives the misleading 'OIDC_ISSUER is required' instead of 'start it with pnpm example:oidc'. If both variables are set, `OIDC_ISSUER` is silently ignored. Consider throwing when both are set, and naming `pnpm example:oidc` in the missing-`OIDC_ISSUER` message.
  - evidence: (none)
- [03-design-review] Exact messages asserted but not specified
  - location: docs/orchestraude/drizzle-admin/03-design/test-strategy.md
  - detail: The `readOidcExampleConfig` rows assert exact messages. example-oidc.md gives the exact text only for the empty-allowlist error; the missing-variable, short-secret, redirect-path and mock-without-NODE_EXTRA_CA_CERTS messages are described only as 'naming X'. Either give the texts (and say that values are never echoed) or let the rows assert that the message contains the variable name.
  - evidence: (none)
- [03-design-review] README should warn that another mount style loops
  - location: docs/orchestraude/drizzle-admin/03-design/interfaces/example-oidc.md
  - detail: README item 3 says the bridge works because of `app.route`. A reader who copies it with `app.mount`, a separate `admin.fetch`, or the bridge registered after the mount gets `getUser` -> null for an allowed user. The result is an endless redirect between `/admin/...` and `/oidc/login` (fail closed, but confusing). Add one sentence saying so.
  - evidence: 2026-10-09-oidc-example-runtime-checks
- [03-design-review] Logout POST without _csrf vs CLAUDE.md security rule
  - location: docs/orchestraude/drizzle-admin/03-design/README.md
  - detail: CLAUDE.md says 'Every POST passes the Origin check and the `_csrf` token check'. The example's `POST /oidc/logout` is Origin-only by design (decision 053 point 7). Add to 'Project rules affected (decision 053)' that the rule covers the library's admin and that the example's logout is Origin-only, so implementer and reviewers do not treat it as a violation.
  - evidence: (none)

