# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] Redundant whitespace checks in safeReturnPath
  - location: example/oidc/return-path.ts:21
  - detail: hasControlChar(next) already covers tab, LF and CR, and /[\s\\]/ then covers them again plus spaces and the backslash; the two checks overlap. Fine as is, but a comment or a single regex would show the intent more directly.
  - evidence: (none)
- [security] TLS guard scan misses some other spellings of disabling verification
  - location: test/tls-verification.test.ts:10
  - detail: The seven names are the ones decision 053 point 2 lists, and the test matches them. But a substring scan for them does not catch the env-var form of npm/pnpm's setting (npm_config_strict_ssl / NPM_CONFIG_STRICT_SSL use an underscore), GIT_SSL_NO_VERIFY, wget --no-check-certificate or curl -k in scripts/ or .github/. The worker environment check covers only the variable Node reads. If the guard is meant to be exhaustive for CI and scripts, add 'strict_ssl', 'GIT_SSL_NO_VERIFY' and '--no-check-certificate' through a design update. Otherwise accept the list as it is.
  - evidence: (none)
- [security] Once-only count in mode.ts no longer proves the name is used only in the check
  - location: example/oidc/mode.ts:5
  - detail: The planner chose to hold the variable name in a module-private constant, so the single occurrence is the constant declaration, not the comparison. The scan exempts mode.ts for that name, and the count test only checks for one occurrence. A later edit inside mode.ts such as `process.env[VERIFICATION_SWITCH] = "0"`, or exporting the constant and assigning through it elsewhere, would pass both guards. The design states the name appears 'exactly once, inside this check'. If that property matters, the once-only test could also assert that mode.ts contains no `export const` and no `process.env` assignment. Otherwise record the weaker guarantee in the task History.
  - evidence: (none)
- [tests] Untested config branches
  - location: test/example-oidc.test.ts:225
  - detail: No row covers real mode with OIDC_AUDIENCE set, mock mode ignoring OIDC_SCOPES, a custom OIDC_MOCK_PORT, a non-default PORT feeding the default redirect URI, or an explicit OIDC_REDIRECT_URI being used as given. Add rows to the 'reads $name' table if these branches should be pinned.
  - evidence: (none)
- [tests] assertTlsVerificationOn wiring not tested through readOidcExampleConfig
  - location: test/example-oidc.test.ts:107
  - detail: Nothing checks that readOidcExampleConfig rejects NODE_TLS_REJECT_UNAUTHORIZED=0, so removing the call from config.ts would pass. Add one throwing row if the wiring should be pinned. The row would need to build the env from a computed key, because this file must not contain the name.
  - evidence: (none)

