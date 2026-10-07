import { messages } from "./messages.js";
import { resolveTimeZone } from "./time.js";
import type { Admin, AdminConfig, AdminState } from "./types.js";

const fail = (message: string): never => {
  throw new Error(`drizzle-admin: ${message}`);
};

function normalizeBasePath(basePath: unknown): string {
  if (typeof basePath !== "string" || !basePath.startsWith("/") || /[?#\\\s]|\/\//.test(basePath)) {
    return fail('basePath must start with "/" and contain no "?", "#", "\\", whitespace or "//"');
  }
  // "/" becomes "" so that `${prefix}/x` never yields a double slash.
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

function normalizePublicOrigin(value: unknown): string {
  const invalid = () =>
    fail(
      "publicOrigin must be an http(s) origin without credentials, path, query or fragment, e.g. https://admin.example.com",
    );
  // `new URL` drops an empty "?" / "#", so reject them on the raw string first.
  if (typeof value !== "string" || /[?#]/.test(value)) return invalid();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid();
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/"
  ) {
    return invalid();
  }
  return url.origin;
}

/**
 * Validates and normalizes `config`. Internal: exported for tests, not from src/index.ts.
 * Every failure throws `Error("drizzle-admin: <message>")`.
 */
export function resolveConfig(config: AdminConfig): AdminState["config"] {
  const { db, dialect, secret, auth, sessionMaxAgeSec } = config;
  if (db === null || db === undefined || typeof db !== "object") {
    fail("db must be a database object");
  }
  if (dialect !== "sqlite" && dialect !== "postgres") {
    fail('dialect must be "sqlite" or "postgres"');
  }
  if (typeof secret !== "string" || secret.length < 32) {
    fail("secret must be a string of at least 32 characters");
  }
  const prefix = normalizeBasePath(config.basePath);
  const hasGetUser = typeof auth?.getUser === "function";
  if (!hasGetUser && typeof auth?.verifyCredentials !== "function") {
    fail("auth must provide verifyCredentials or getUser");
  }
  if (
    sessionMaxAgeSec !== undefined &&
    (!Number.isInteger(sessionMaxAgeSec) || sessionMaxAgeSec <= 0)
  ) {
    fail("sessionMaxAgeSec must be a positive integer");
  }
  return {
    db,
    dialect,
    prefix,
    siteTitle: config.siteTitle ?? messages.defaultSiteTitle,
    secret,
    sessionMaxAgeSec: sessionMaxAgeSec ?? 28800,
    timeZone: resolveTimeZone(config.timeZone),
    // getUser wins when both are set (decision 013 item 8).
    authMode: hasGetUser ? "external" : "builtin",
    auth,
    publicOrigin:
      config.publicOrigin === undefined ? null : normalizePublicOrigin(config.publicOrigin),
  };
}

export function createAdmin(config: AdminConfig): Admin {
  resolveConfig(config);
  const notImplemented = (): never => fail("not implemented");
  // register, app and fetch are implemented in task 05.
  return {
    register: notImplemented,
    get app(): never {
      return notImplemented();
    },
    fetch: notImplemented,
  };
}
