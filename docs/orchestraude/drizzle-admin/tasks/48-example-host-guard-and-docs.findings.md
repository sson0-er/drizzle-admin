# Review findings

high: 0, medium: 0, low: 3

## high


## medium


## low

- [spec] design ambiguity: README CSP string uses the constant name instead of the hash value
  - location: README.md:257
  - detail: The task says to write the CSP strings 'with the literal hash `SELECT_ALL_SCRIPT_SHA256` from src/static/select-all.ts', and routes.md writes it as the placeholder `<SELECT_ALL_SCRIPT_SHA256>`. The README writes `script-src 'sha256-SELECT_ALL_SCRIPT_SHA256'` and explains in the next sentence that this name stands for the hash. That is one valid reading, but 'literal hash ... from src/static/select-all.ts' could also mean the actual value (`v/peDHOfIZWrfvqqPHbyzhkt2GMZ+0UvE0ARRSfmSAU=`). The README's host-CSP note tells host apps to allow the same sources, and readers would need the real value for that. The real value, however, goes stale whenever the script changes. The orchestrator should ask the user which form they want. If they choose the value, add it to the CLAUDE.md rule about updating the hash together with the script.
  - evidence: (none)
- [tests] Wildcard-bind branches not exercised
  - location: test/example.test.ts:93
  - detail: No row covers bind 0.0.0.0 or :: with a loopback name (http://localhost:3000/ -> true), the IPv6 wildcard bind (bind '::' with http://[2001:db8::1]:3000/ -> true, which uses the h.startsWith('[') branch), a bind host with uppercase letters, or an https URL with no explicit port (443 default). Add rows if desired; they are beyond the specified table.
  - evidence: (none)
- [tests] hostGuard test does not show next is skipped on rejection
  - location: test/example.test.ts:111
  - detail: The 403 case implies the handler body was not served (body is the guard text), so this is acceptable; a hostile Host header with a port mismatch through the middleware is covered only at the isAllowedHost level.
  - evidence: (none)

