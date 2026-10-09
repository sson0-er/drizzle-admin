# Review findings

high: 0, medium: 0, low: 1

## high


## medium


## low

- [security] Cert dir with private key is left behind on SIGHUP
  - location: example/oidc/launch.ts:33
  - detail: Only SIGINT and SIGTERM get handlers, which is what the design asks for (example-oidc.md line 170). Closing the terminal sends SIGHUP to the launcher, and Node's default action ends the process without running the child 'exit' handler. That leaves /tmp/drizzle-admin-oidc-*/ behind with key.pem. The impact is small: the directory is created by mkdtemp (0700) and key.pem is 0600. Only processes that were given that cert through NODE_EXTRA_CA_CERTS trust it, and those processes are gone. If wanted, add SIGHUP to the forwarded signals (and to the design), so the launcher waits for the child and cleans up the same way.
  - evidence: (none)

