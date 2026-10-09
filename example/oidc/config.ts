import { randomBytes } from "node:crypto";
import type { OidcAuthEnv } from "@hono/oidc-auth";
import { type Allowlist, parseAllowlist } from "./allowlist.js";
import { assertTlsVerificationOn, type OidcMode, selectMode } from "./mode.js";

export interface OidcExampleConfig {
  mode: OidcMode;
  port: number;
  hostname: string;
  secret: string;
  mockCert: { dir: string; port: number } | null;
  oidc: Omit<Required<OidcAuthEnv>, "OIDC_ISSUER">;
  issuer: string | null;
  allow: Allowlist;
  notes: string[];
}

const CALLBACK_PATH = "/oidc/callback";

function randomSecret(): string {
  return randomBytes(32).toString("hex");
}

function requireInRealMode(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required when OIDC_ISSUER is set.`);
  return value;
}

function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") && url.pathname === CALLBACK_PATH
    );
  } catch {
    return false;
  }
}

/**
 * Turns the environment into the example's settings. Messages never include values, so a secret
 * that fails a check is not echoed.
 */
export function readOidcExampleConfig(env: Record<string, string | undefined>): OidcExampleConfig {
  assertTlsVerificationOn(env);
  const mode = selectMode(env);
  const real = mode === "real";

  if (real && env.OIDC_MOCK_CERT_DIR) {
    throw new Error(
      'OIDC_MOCK_CERT_DIR is set by "pnpm example:oidc" for mock mode only; unset it when OIDC_ISSUER is set.',
    );
  }
  if (!real && (!env.OIDC_MOCK_CERT_DIR || !env.NODE_EXTRA_CA_CERTS)) {
    throw new Error(
      'Mock mode needs the generated certificate: start it with "pnpm example:oidc", or set OIDC_ISSUER to use a real IdP.',
    );
  }
  const client = real
    ? {
        id: requireInRealMode(env, "OIDC_CLIENT_ID"),
        secret: requireInRealMode(env, "OIDC_CLIENT_SECRET"),
      }
    : { id: "drizzle-admin-example", secret: "example-only-secret" };
  // The library answers 500 on every OIDC route with a shorter key, so refuse at startup.
  if (env.OIDC_AUTH_SECRET !== undefined && env.OIDC_AUTH_SECRET.length < 32) {
    throw new Error("OIDC_AUTH_SECRET must be at least 32 characters.");
  }

  const port = Number(env.PORT ?? 3000);
  const redirectUri = env.OIDC_REDIRECT_URI ?? `http://localhost:${port}${CALLBACK_PATH}`;
  if (!isValidRedirectUri(redirectUri)) {
    throw new Error(
      `OIDC_REDIRECT_URI must be an absolute http or https URL whose path is ${CALLBACK_PATH}.`,
    );
  }

  let allow = parseAllowlist(env.OIDC_ALLOWED_SUBJECTS, env.OIDC_ALLOWED_EMAIL_DOMAINS);
  const allowIsEmpty = allow.subjects.length === 0 && allow.emailDomains.length === 0;
  if (real && allowIsEmpty) {
    throw new Error(
      "OIDC_ALLOWED_SUBJECTS or OIDC_ALLOWED_EMAIL_DOMAINS must list at least one entry when OIDC_ISSUER is set.",
    );
  }
  const defaultAllowlist = !real && allowIsEmpty;
  if (defaultAllowlist) allow = { subjects: ["demo"], emailDomains: [] };

  const notes: string[] = [];
  if (env.ADMIN_SECRET === undefined) {
    notes.push("Note: ADMIN_SECRET is not set; admin sessions will not survive a restart.");
  }
  if (env.OIDC_AUTH_SECRET === undefined) {
    notes.push("Note: OIDC_AUTH_SECRET is not set; sign-ins will not survive a restart.");
  }
  if (defaultAllowlist) {
    notes.push(
      'Sign in at the mock IdP as "demo" (other names are refused); the browser warns about its certificate.',
    );
  }

  return {
    mode,
    port,
    hostname: env.HOST || "127.0.0.1",
    secret: env.ADMIN_SECRET ?? randomSecret(),
    // Only mock mode gets here with the directory set (the checks above), so it decides the value.
    mockCert: env.OIDC_MOCK_CERT_DIR
      ? { dir: env.OIDC_MOCK_CERT_DIR, port: Number(env.OIDC_MOCK_PORT ?? 3001) }
      : null,
    // Every library key is set here, so @hono/oidc-auth never falls back to process.env.
    oidc: {
      OIDC_AUTH_SECRET: env.OIDC_AUTH_SECRET ?? randomSecret(),
      OIDC_REDIRECT_URI: redirectUri,
      OIDC_CLIENT_ID: client.id,
      OIDC_CLIENT_SECRET: client.secret,
      OIDC_SCOPES: real ? env.OIDC_SCOPES || "openid email" : "openid email offline_access",
      OIDC_AUDIENCE: real ? (env.OIDC_AUDIENCE ?? "") : "",
      OIDC_AUTH_REFRESH_INTERVAL: "900",
      OIDC_AUTH_EXPIRES: "86400",
      OIDC_COOKIE_NAME: "oidc-auth",
      OIDC_COOKIE_PATH: "/",
      OIDC_COOKIE_DOMAIN: "",
      OIDC_AUTH_EXTERNAL_URL: "",
      OIDC_JWT_ALG: "HS256",
    },
    // Empty in mock mode (see selectMode), so this is null there and the issuer in real mode.
    issuer: env.OIDC_ISSUER || null,
    allow,
    notes,
  };
}
