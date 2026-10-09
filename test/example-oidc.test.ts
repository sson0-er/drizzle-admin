import { createServer } from "node:https";
import type { AddressInfo } from "node:net";
import type { OidcAuthEnv } from "@hono/oidc-auth";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type Allowlist,
  isAllowed,
  type OidcIdentity,
  parseAllowlist,
} from "../example/oidc/allowlist.js";
import { createOidcExampleApp } from "../example/oidc/app.js";
import { generateLocalhostCert, readLocalhostCert } from "../example/oidc/cert.js";
import { readOidcExampleConfig } from "../example/oidc/config.js";
import { type MockIdp, startMockIdp } from "../example/oidc/mock-idp.js";
import { selectMode } from "../example/oidc/mode.js";
import { safeReturnPath } from "../example/oidc/return-path.js";
import { type Client, createClient, TEST_SECRET } from "./helpers/app.js";
import { attr, parse, qs, qsa, text } from "./helpers/html.js";

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

const APP_ORIGIN = "http://localhost";
const demoOnly: Allowlist = { subjects: ["demo"], emailDomains: [] };

describe("OIDC flow against the mock IdP", () => {
  let idp: MockIdp;
  const savedEnv = new Map<string, string>();

  beforeAll(async () => {
    // A developer's shell must not reach the test app.
    for (const [name, value] of Object.entries(process.env)) {
      if (name.startsWith("OIDC_") && name !== "OIDC_MOCK_CERT_DIR") {
        savedEnv.set(name, value as string);
        delete process.env[name];
      }
    }
    idp = await startMockIdp({
      // The global setup (test/helpers/oidc-global-setup.ts) sets OIDC_MOCK_CERT_DIR.
      ...readLocalhostCert(process.env.OIDC_MOCK_CERT_DIR!),
      port: 0,
      clientId: "test-client",
      clientSecret: "test-client-secret",
      redirectUris: [`${APP_ORIGIN}/oidc/callback`],
    });
  });

  afterAll(async () => {
    await idp.close();
    for (const [name, value] of savedEnv) process.env[name] = value;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function makeApp(allow: Allowlist = demoOnly): Promise<Client> {
    const oidc: Required<OidcAuthEnv> = {
      OIDC_ISSUER: idp.issuer,
      OIDC_CLIENT_ID: "test-client",
      OIDC_CLIENT_SECRET: "test-client-secret",
      OIDC_REDIRECT_URI: `${APP_ORIGIN}/oidc/callback`,
      OIDC_AUTH_SECRET: "o".repeat(32),
      OIDC_SCOPES: "openid email offline_access",
      OIDC_AUDIENCE: "",
      OIDC_AUTH_REFRESH_INTERVAL: "900",
      OIDC_AUTH_EXPIRES: "86400",
      OIDC_COOKIE_NAME: "oidc-auth",
      OIDC_COOKIE_PATH: "/",
      OIDC_COOKIE_DOMAIN: "",
      OIDC_AUTH_EXTERNAL_URL: "",
      OIDC_JWT_ALG: "HS256",
    };
    const { app } = await createOidcExampleApp({ secret: TEST_SECRET, oidc, allow });
    return createClient((req) => app.fetch(req));
  }

  /** Walks the IdP's login and consent pages with a fresh cookie jar; returns the redirect back. */
  async function signInAtIdp(authorizeUrl: string, login: string): Promise<URL> {
    const idpOrigin = new URL(idp.issuer).origin;
    const jar = new Map<string, string>();
    let url = new URL(authorizeUrl);
    let init: RequestInit = {};
    for (let step = 0; step < 10; step++) {
      const headers = new Headers(init.headers);
      if (jar.size > 0) headers.set("Cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      const res = await fetch(url, { ...init, headers, redirect: "manual" });
      for (const line of res.headers.getSetCookie()) {
        const pair = line.split(";")[0] ?? "";
        const eq = pair.indexOf("=");
        jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
      const location = res.headers.get("Location");
      if (location !== null) {
        url = new URL(location, url);
        if (url.origin !== idpOrigin) return url;
        init = {};
        continue;
      }
      expect(res.status).toBe(200);
      const page = parse(await res.text());
      const action = attr(qs(page, { tag: "form" }) ?? page, "action");
      if (action === null) throw new Error("signInAtIdp: no form on the IdP page");
      const hasLogin = qs(page, { tag: "input", attrs: { name: "login" } }) !== null;
      url = new URL(action, url);
      init = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: hasLogin ? `prompt=login&login=${login}&password=x` : "prompt=consent",
      };
    }
    throw new Error("signInAtIdp: no redirect back to the app after 10 steps");
  }

  const locationOf = (res: Response): string => {
    const location = res.headers.get("Location");
    if (location === null) throw new Error(`no Location header (status ${res.status})`);
    return location;
  };

  /** Path and query of a Location on the app origin (absolute or relative). */
  const pathOf = (res: Response): string => {
    const url = new URL(locationOf(res), APP_ORIGIN);
    expect(url.origin).toBe(APP_ORIGIN);
    return url.pathname + url.search;
  };

  const formActions = (html: string): (string | null)[] =>
    qsa(parse(html), { tag: "form" }).map((form) => attr(form, "action"));

  /** Steps 1-4 of the flow; returns the response of the second `GET /oidc/login`. */
  async function signIn(client: Client, login: string): Promise<Response> {
    const guard = await client.get("/admin/users/");
    const toIdp = await client.get(pathOf(guard));
    const callback = await signInAtIdp(locationOf(toIdp), login);
    const back = await client.get(callback.pathname + callback.search);
    return client.get(pathOf(back));
  }

  it("signs in through the IdP, passes the admin and signs out", async () => {
    const client = await makeApp();

    const guard = await client.get("/admin/users/?q=a");
    expect(guard.status).toBe(302);
    expect(guard.headers.get("Location")).toBe("/oidc/login?next=%2Fadmin%2Fusers%2F%3Fq%3Da");

    const toIdp = await client.get(locationOf(guard));
    expect(toIdp.status).toBe(302);
    expect(toIdp.headers.get("Location")).toMatch(new RegExp(`^${idp.issuer}/`));

    const callback = await signInAtIdp(locationOf(toIdp), "demo");
    expect(callback.origin).toBe(APP_ORIGIN);
    expect(callback.pathname).toBe("/oidc/callback");

    const back = await client.get(callback.pathname + callback.search);
    expect(back.status).toBe(302);
    expect(back.headers.get("Location")).toBe(
      `${APP_ORIGIN}/oidc/login?next=%2Fadmin%2Fusers%2F%3Fq%3Da`,
    );

    const resumed = await client.get(pathOf(back));
    expect(resumed.status).toBe(302);
    expect(resumed.headers.get("Location")).toBe("/admin/users/?q=a");

    const page = await client.get("/admin/users/?q=a");
    expect(page.status).toBe(200);
    expect(qsa(parse(await page.text()), { cls: "user-name" }).map(text)).toEqual([
      "demo@example.test",
    ]);

    const unsafe = await client.get("/oidc/login?next=%2F%2Fevil.example%2F");
    expect(unsafe.status).toBe(302);
    expect(unsafe.headers.get("Location")).toBe("/admin/");

    const logout = await client.post("/oidc/logout", {}, { withToken: false });
    expect(logout.status).toBe(303);
    expect(logout.headers.get("Location")).toBe("/");
    expect(client.cookie("oidc-auth")).toBeUndefined();

    const again = await client.get("/admin/");
    expect(again.status).toBe(302);
    expect(again.headers.get("Location")).toBe("/oidc/login?next=%2Fadmin%2F");
  });

  it.each([
    {
      name: "a listed subject",
      login: "demo",
      allow: demoOnly,
      signInStatus: 302,
      adminStatus: 200,
    },
    {
      name: "a user that is not listed",
      login: "mallory",
      allow: demoOnly,
      signInStatus: 403,
      adminStatus: 403,
    },
    {
      name: "a listed email domain",
      login: "demo",
      allow: { subjects: [], emailDomains: ["example.test"] },
      signInStatus: 302,
      adminStatus: 200,
    },
    {
      name: "another email domain",
      login: "demo",
      allow: { subjects: [], emailDomains: ["other.test"] },
      signInStatus: 403,
      adminStatus: 403,
    },
    {
      name: "an empty allowlist",
      login: "demo",
      allow: { subjects: [], emailDomains: [] },
      signInStatus: 403,
      adminStatus: 403,
    },
  ])("answers $signInStatus then $adminStatus for $name", async (row) => {
    const client = await makeApp(row.allow);

    const signedIn = await signIn(client, row.login);
    expect(signedIn.status).toBe(row.signInStatus);
    if (row.signInStatus === 302) {
      expect(signedIn.headers.get("Location")).toBe("/admin/users/");
    } else {
      const html = await signedIn.text();
      expect(html).toContain("Access denied");
      expect(html).toContain(`${row.login}@example.test`);
      expect(formActions(html)).toEqual(["/oidc/logout"]);
    }

    const admin = await client.get("/admin/users/");
    expect(admin.status).toBe(row.adminStatus);
    if (row.adminStatus === 403) {
      const html = await admin.text();
      expect(text(parse(html))).toContain("Access denied");
      expect(qs(parse(html), { cls: "user-name" })).toBeNull();
      expect(formActions(html)).toEqual(["/oidc/logout"]);
    }
  });

  it("rejects a TLS certificate that is not trusted", async () => {
    const { key, cert } = await generateLocalhostCert();
    const server = createServer({ key, cert }, (_req, res) => {
      res.end("ok");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const error = await fetch(`https://localhost:${port}/`).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TypeError);
      expect((error as { cause?: { code?: string } }).cause?.code).toBe(
        "DEPTH_ZERO_SELF_SIGNED_CERT",
      );
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it("ignores OIDC_* variables of the shell", async () => {
    vi.stubEnv("OIDC_COOKIE_PATH", "/elsewhere");
    vi.stubEnv("OIDC_SCOPES", "bogus");
    vi.stubEnv("OIDC_AUTH_EXTERNAL_URL", "https://evil.example");
    const client = await makeApp();

    const signedIn = await signIn(client, "demo");
    expect(signedIn.status).toBe(302);
    expect(signedIn.headers.get("Location")).toBe("/admin/users/");
    expect((await client.get("/admin/users/")).status).toBe(200);
  });

  it("answers a failed callback with a generic page and clears the flow cookies", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = await makeApp();

    const res = await client.get(
      "/oidc/callback?error=access_denied&error_description=detail-from-idp&state=x",
    );

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Sign-in failed");
    expect(body).not.toContain("access_denied");
    expect(body).not.toContain("detail-from-idp");
    const cookies = res.headers.getSetCookie();
    for (const name of ["state", "nonce", "code_verifier", "continue"]) {
      const lines = cookies.filter((line) => line.startsWith(`${name}=`));
      // The library deletes `state` itself before it throws, so that name may appear twice.
      expect(lines.length).toBeGreaterThanOrEqual(1);
      for (const line of lines) {
        expect(line).toContain("Max-Age=0");
        expect(line).toContain("Path=/oidc/callback");
      }
    }
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[1]).not.toContain("detail-from-idp");
    log.mockRestore();
  });

  it("refuses a logout from another origin", async () => {
    const client = await makeApp();
    await signIn(client, "demo");

    const res = await client.post(
      "/oidc/logout",
      {},
      { withToken: false, headers: { Origin: "https://evil.example" } },
    );

    expect(res.status).toBe(403);
    expect(client.cookie("oidc-auth")).toBeDefined();
  });

  it("shows a sign-in link on / when signed out", async () => {
    const client = await makeApp();

    const res = await client.get("/");

    expect(res.status).toBe(200);
    const page = parse(await res.text());
    expect(qsa(page, { tag: "a" }).map((a) => attr(a, "href"))).toEqual(["/admin/"]);
    expect(qs(page, { tag: "form" })).toBeNull();
  });

  it("shows the user and a sign-out form on / when signed in", async () => {
    const client = await makeApp();
    await signIn(client, "demo");

    const res = await client.get("/");

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(text(parse(html))).toContain("Signed in as demo@example.test");
    expect(formActions(html)).toEqual(["/oidc/logout"]);
  });
});
