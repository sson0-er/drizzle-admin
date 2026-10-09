import { describe, expect, it } from "vitest";
import {
  type Allowlist,
  isAllowed,
  type OidcIdentity,
  parseAllowlist,
} from "../example/oidc/allowlist.js";
import { readOidcExampleConfig } from "../example/oidc/config.js";
import { selectMode } from "../example/oidc/mode.js";
import { safeReturnPath } from "../example/oidc/return-path.js";

describe("safeReturnPath", () => {
  it.each([
    { name: "missing", next: undefined, expected: "/admin/" },
    { name: "a path with a query", next: "/admin/users/?q=a", expected: "/admin/users/?q=a" },
    { name: "an encoded space", next: "/admin/users/a%20b/", expected: "/admin/users/a%20b/" },
    { name: "a protocol-relative URL", next: "//evil.example/", expected: "/admin/" },
    { name: "a backslash after the slash", next: "/\\evil.example/", expected: "/admin/" },
    { name: "an absolute URL", next: "https://evil.example/admin/", expected: "/admin/" },
    { name: "a path outside the prefix", next: "/other/", expected: "/admin/" },
    { name: "a double slash in the path", next: "/admin//x/", expected: "/admin/" },
    { name: "encoded dot segments", next: "/admin/%2e%2e/%2e%2e/x", expected: "/admin/" },
    { name: "a raw tab", next: "/admin/x\ty/", expected: "/admin/" },
    { name: "an encoded newline", next: "/admin/%0a/", expected: "/admin/" },
    { name: "a malformed escape", next: "/admin/%zz/", expected: "/admin/" },
  ])("returns $expected for $name", ({ next, expected }) => {
    expect(safeReturnPath(next, "/admin")).toBe(expected);
  });
});

describe("isAllowed", () => {
  const none: Allowlist = { subjects: [], emailDomains: [] };
  const subjects: Allowlist = { subjects: ["a"], emailDomains: [] };
  const domain: Allowlist = { subjects: [], emailDomains: ["example.test"] };
  const identity = (sub: string, email: string, emailVerified: boolean): OidcIdentity => ({
    sub,
    email,
    emailVerified,
  });

  it.each([
    { name: "a listed subject", id: identity("a", "", false), allow: subjects, expected: true },
    {
      name: "a subject in another case",
      id: identity("A", "", false),
      allow: subjects,
      expected: false,
    },
    { name: "an unlisted subject", id: identity("b", "", false), allow: subjects, expected: false },
    {
      name: "a verified listed domain",
      id: identity("x", "x@example.test", true),
      allow: domain,
      expected: true,
    },
    {
      name: "a domain in another case",
      id: identity("x", "x@EXAMPLE.TEST", true),
      allow: domain,
      expected: true,
    },
    {
      name: "an unverified listed domain",
      id: identity("x", "x@example.test", false),
      allow: domain,
      expected: false,
    },
    {
      name: "a subdomain of a listed domain",
      id: identity("x", "x@sub.example.test", true),
      allow: domain,
      expected: false,
    },
    {
      name: "several @ signs (the last one counts)",
      id: identity("x", "x@a@example.test", true),
      allow: domain,
      expected: true,
    },
    { name: "an empty email", id: identity("x", "", true), allow: domain, expected: false },
    {
      name: "empty lists",
      id: identity("a", "a@example.test", true),
      allow: none,
      expected: false,
    },
  ])("returns $expected for $name", ({ id, allow, expected }) => {
    expect(isAllowed(id, allow)).toBe(expected);
  });
});

describe("parseAllowlist", () => {
  it.each([
    {
      name: "both undefined",
      subjects: undefined,
      domains: undefined,
      expected: { subjects: [], emailDomains: [] },
    },
    {
      name: "padded subjects with an empty entry",
      subjects: " a , ,b ",
      domains: undefined,
      expected: { subjects: ["a", "b"], emailDomains: [] },
    },
    {
      name: "mixed-case domains",
      subjects: undefined,
      domains: "Example.TEST, x.test",
      expected: { subjects: [], emailDomains: ["example.test", "x.test"] },
    },
  ])("parses $name", ({ subjects, domains, expected }) => {
    expect(parseAllowlist(subjects, domains)).toEqual(expected);
  });
});

describe("readOidcExampleConfig", () => {
  type Config = ReturnType<typeof readOidcExampleConfig>;
  const realBase = {
    OIDC_ISSUER: "https://idp.example",
    OIDC_CLIENT_ID: "c",
    OIDC_CLIENT_SECRET: "s",
    OIDC_ALLOWED_SUBJECTS: "u1",
  };
  const mockBase = { OIDC_MOCK_CERT_DIR: "/tmp/x", NODE_EXTRA_CA_CERTS: "/tmp/x/cert.pem" };
  const emptyAllowMessage =
    "OIDC_ALLOWED_SUBJECTS or OIDC_ALLOWED_EMAIL_DOMAINS must list at least one entry when OIDC_ISSUER is set.";
  const needsCertMessage =
    'Mock mode needs the generated certificate: start it with "pnpm example:oidc", or set OIDC_ISSUER to use a real IdP.';
  const redirectMessage =
    "OIDC_REDIRECT_URI must be an absolute http or https URL whose path is /oidc/callback.";
  const { OIDC_ALLOWED_SUBJECTS: _subjects, ...realWithoutAllow } = realBase;
  const { OIDC_CLIENT_ID: _clientId, ...realWithoutClientId } = realBase;

  it.each([
    { name: "real without an allowlist", env: realWithoutAllow, message: emptyAllowMessage },
    {
      name: "real with only empty subject entries",
      env: { ...realWithoutAllow, OIDC_ALLOWED_SUBJECTS: " , " },
      message: emptyAllowMessage,
    },
    {
      name: "real without OIDC_CLIENT_ID",
      env: realWithoutClientId,
      message: "OIDC_CLIENT_ID is required when OIDC_ISSUER is set.",
    },
    {
      name: "real with an empty OIDC_CLIENT_SECRET",
      env: { ...realBase, OIDC_CLIENT_SECRET: "" },
      message: "OIDC_CLIENT_SECRET is required when OIDC_ISSUER is set.",
    },
    {
      name: "real with OIDC_MOCK_CERT_DIR",
      env: { ...realBase, OIDC_MOCK_CERT_DIR: "/tmp/x" },
      message:
        'OIDC_MOCK_CERT_DIR is set by "pnpm example:oidc" for mock mode only; unset it when OIDC_ISSUER is set.',
    },
    { name: "neither OIDC_ISSUER nor OIDC_MOCK_CERT_DIR", env: {}, message: needsCertMessage },
    {
      name: "mock without NODE_EXTRA_CA_CERTS",
      env: { OIDC_MOCK_CERT_DIR: "/tmp/x" },
      message: needsCertMessage,
    },
    {
      name: "real with a 31-character OIDC_AUTH_SECRET",
      env: { ...realBase, OIDC_AUTH_SECRET: "x".repeat(31) },
      message: "OIDC_AUTH_SECRET must be at least 32 characters.",
    },
    {
      name: "real with a redirect URI of the wrong path",
      env: { ...realBase, OIDC_REDIRECT_URI: "http://localhost:3000/callback" },
      message: redirectMessage,
    },
    {
      name: "real with a relative redirect URI",
      env: { ...realBase, OIDC_REDIRECT_URI: "/oidc/callback" },
      message: redirectMessage,
    },
  ])("throws for $name", ({ env, message }) => {
    expect(() => readOidcExampleConfig(env)).toThrow(new Error(message));
  });

  it("reads the real base environment", () => {
    const { oidc, ...config } = readOidcExampleConfig(realBase);
    const { OIDC_AUTH_SECRET, ...library } = oidc;
    expect(config).toMatchObject({
      mode: "real",
      issuer: "https://idp.example",
      mockCert: null,
      allow: { subjects: ["u1"], emailDomains: [] },
    });
    expect(library).toEqual({
      OIDC_CLIENT_ID: "c",
      OIDC_CLIENT_SECRET: "s",
      OIDC_REDIRECT_URI: "http://localhost:3000/oidc/callback",
      OIDC_SCOPES: "openid email",
      OIDC_AUDIENCE: "",
      OIDC_AUTH_REFRESH_INTERVAL: "900",
      OIDC_AUTH_EXPIRES: "86400",
      OIDC_COOKIE_NAME: "oidc-auth",
      OIDC_COOKIE_PATH: "/",
      OIDC_COOKIE_DOMAIN: "",
      OIDC_AUTH_EXTERNAL_URL: "",
      OIDC_JWT_ALG: "HS256",
    });
    expect(OIDC_AUTH_SECRET).toHaveLength(64);
  });

  it.each([
    {
      name: "real with OIDC_SCOPES",
      env: { ...realBase, OIDC_SCOPES: "openid email offline_access" },
      pick: (c: Config) => c.oidc.OIDC_SCOPES,
      expected: "openid email offline_access",
    },
    {
      name: "real with OIDC_COOKIE_PATH (ignored)",
      env: { ...realBase, OIDC_COOKIE_PATH: "/elsewhere" },
      pick: (c: Config) => c.oidc.OIDC_COOKIE_PATH,
      expected: "/",
    },
    {
      name: "real with email domains only",
      env: { ...realWithoutAllow, OIDC_ALLOWED_EMAIL_DOMAINS: "example.com" },
      pick: (c: Config) => c.allow.emailDomains,
      expected: ["example.com"],
    },
    { name: "mock base (mode)", env: mockBase, pick: (c: Config) => c.mode, expected: "mock" },
    { name: "mock base (issuer)", env: mockBase, pick: (c: Config) => c.issuer, expected: null },
    {
      name: "mock base (mockCert)",
      env: mockBase,
      pick: (c: Config) => c.mockCert,
      expected: { dir: "/tmp/x", port: 3001 },
    },
    {
      name: "mock base (allow)",
      env: mockBase,
      pick: (c: Config) => c.allow,
      expected: { subjects: ["demo"], emailDomains: [] },
    },
    {
      name: "mock base (scopes)",
      env: mockBase,
      pick: (c: Config) => c.oidc.OIDC_SCOPES,
      expected: "openid email offline_access",
    },
    {
      name: "mock with OIDC_ALLOWED_SUBJECTS",
      env: { ...mockBase, OIDC_ALLOWED_SUBJECTS: "alice" },
      pick: (c: Config) => c.allow.subjects,
      expected: ["alice"],
    },
  ])("reads $name", ({ env, pick, expected }) => {
    expect(pick(readOidcExampleConfig(env))).toEqual(expected);
  });

  it.each([
    {
      name: "mock with unset secrets and the default allowlist",
      env: mockBase,
      notes: [
        "Note: ADMIN_SECRET is not set; admin sessions will not survive a restart.",
        "Note: OIDC_AUTH_SECRET is not set; sign-ins will not survive a restart.",
        'Sign in at the mock IdP as "demo" (other names are refused); the browser warns about its certificate.',
      ],
    },
    {
      name: "mock with an explicit allowlist and both secrets",
      env: {
        ...mockBase,
        OIDC_ALLOWED_SUBJECTS: "alice",
        ADMIN_SECRET: "a".repeat(32),
        OIDC_AUTH_SECRET: "o".repeat(32),
      },
      notes: [],
    },
    {
      name: "real with unset secrets",
      env: realBase,
      notes: [
        "Note: ADMIN_SECRET is not set; admin sessions will not survive a restart.",
        "Note: OIDC_AUTH_SECRET is not set; sign-ins will not survive a restart.",
      ],
    },
  ])("prints the notes for $name", ({ env, notes }) => {
    expect(readOidcExampleConfig(env).notes).toEqual(notes);
  });

  it.each([
    { name: "defaults", env: mockBase, expected: { port: 3000, hostname: "127.0.0.1" } },
    {
      name: "an empty HOST",
      env: { ...mockBase, HOST: "", PORT: "4000" },
      expected: { port: 4000, hostname: "127.0.0.1" },
    },
  ])("reads the listen address for $name", ({ env, expected }) => {
    expect(readOidcExampleConfig(env)).toMatchObject(expected);
  });
});

describe("selectMode", () => {
  it.each([
    { name: "an empty environment", env: {}, expected: "mock" },
    { name: "an empty issuer", env: { OIDC_ISSUER: "" }, expected: "mock" },
    { name: "an issuer", env: { OIDC_ISSUER: "https://idp.example" }, expected: "real" },
  ])("returns $expected for $name", ({ env, expected }) => {
    expect(selectMode(env)).toBe(expected);
  });
});
