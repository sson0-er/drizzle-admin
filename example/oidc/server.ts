import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { hostGuard } from "../host-guard.js";
import { createOidcExampleApp } from "./app.js";
import { readLocalhostCert } from "./cert.js";
import { readOidcExampleConfig } from "./config.js";
import { startMockIdp } from "./mock-idp.js";

// Child process of launch.ts, which sets up the certificate for mock mode.
let config: ReturnType<typeof readOidcExampleConfig>;
try {
  config = readOidcExampleConfig(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// readOidcExampleConfig sets mockCert exactly in mock mode and issuer exactly in real mode.
const { mockCert } = config;
const idp = mockCert
  ? await startMockIdp({
      ...readLocalhostCert(mockCert.dir),
      port: mockCert.port,
      clientId: config.oidc.OIDC_CLIENT_ID,
      clientSecret: config.oidc.OIDC_CLIENT_SECRET,
      redirectUris: [config.oidc.OIDC_REDIRECT_URI],
    })
  : null;
// biome-ignore lint/style/noNonNullAssertion: without a mock IdP the mode is real, so issuer is set.
const issuer = idp ? idp.issuer : config.issuer!;

const { app } = await createOidcExampleApp({
  secret: config.secret,
  oidc: { ...config.oidc, OIDC_ISSUER: issuer },
  allow: config.allow,
});
const root = new Hono();
root.use("*", hostGuard(config.hostname, config.port));
root.route("/", app);
serve({ fetch: root.fetch, port: config.port, hostname: config.hostname }, () => {
  console.log(`drizzle-admin OIDC demo: http://localhost:${config.port}/admin/`);
  if (idp) console.log(`Mock IdP: ${idp.issuer}`);
  for (const note of config.notes) console.log(note);
});
