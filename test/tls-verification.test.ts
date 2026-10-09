import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertTlsVerificationOn } from "../example/oidc/mode.js";

// Decision 053 point 2: certificate verification is never turned off. The names are spelled out
// here because this file is the guard; it is skipped by the scan below.
const tlsVariable = "NODE_TLS_REJECT_UNAUTHORIZED";
const forbidden = [
  tlsVariable,
  "rejectUnauthorized",
  "allowInsecureRequests",
  "checkServerIdentity",
  "strict-ssl",
  "strictSsl",
  "--insecure",
];

const root = fileURLToPath(new URL("../", import.meta.url));
const self = "test/tls-verification.test.ts";
const modeFile = "example/oidc/mode.ts";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const scanned = [
  ...["src", "test", "example", "scripts", ".github"]
    .map((dir) => join(root, dir))
    .filter(existsSync)
    .flatMap(walk),
  ...[
    "package.json",
    "vitest.config.ts",
    "tsconfig.json",
    "tsconfig.build.json",
    "mise.toml",
    ".npmrc",
    "pnpm-workspace.yaml",
  ]
    .map((file) => join(root, file))
    .filter(existsSync),
]
  .map((file) => relative(root, file))
  .filter((file) => file !== self);

describe("TLS verification guard", () => {
  it.each(forbidden)("no scanned file contains %s", (name) => {
    const offenders = scanned.filter(
      (file) =>
        !(name === tlsVariable && file === modeFile) &&
        readFileSync(join(root, file), "utf8").includes(name),
    );
    expect(offenders).toEqual([]);
  });

  it("names the variable exactly once in mode.ts", () => {
    const source = readFileSync(join(root, modeFile), "utf8");
    expect(source.split(tlsVariable).length - 1).toBe(1);
  });

  it("does not inherit a disabled verification setting in the worker", () => {
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });
});

describe("assertTlsVerificationOn", () => {
  it("refuses to run when verification is disabled", () => {
    expect(() => assertTlsVerificationOn({ [tlsVariable]: "0" })).toThrow(
      new Error(
        "NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate verification; unset it to run this example.",
      ),
    );
  });

  it.each([
    { name: "unset", env: {} },
    { name: "set to 1", env: { [tlsVariable]: "1" } },
  ])("accepts an environment where the variable is $name", ({ env }) => {
    expect(() => assertTlsVerificationOn(env)).not.toThrow();
  });
});
