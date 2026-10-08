import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

// Hand-listed on purpose: a field added to the public types must also be added here and documented.
const ADMIN_CONFIG_KEYS = [
  "db",
  "dialect",
  "basePath",
  "siteTitle",
  "secret",
  "auth",
  "sessionMaxAgeSec",
  "timeZone",
  "publicOrigin",
];
const AUTH_CONFIG_KEYS = ["verifyCredentials", "getUser", "loginUrl"];
const MODEL_OPTION_KEYS = [
  "slug",
  "label",
  "listDisplay",
  "listDisplayLinks",
  "searchFields",
  "listFilter",
  "ordering",
  "listPerPage",
  "fields",
  "exclude",
  "readonlyFields",
  "fieldsets",
  "widgets",
  "formatters",
  "toString",
  "validate",
  "hooks",
  "permissions",
  "actions",
];

/** Splits the README into its `##` sections (heading text without the `## ` prefix). */
function sections(): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  let fence = false;
  for (const line of readme.split("\n")) {
    if (line.startsWith("```")) fence = !fence;
    const heading = fence ? null : /^## (.+)$/.exec(line);
    if (heading?.[1] !== undefined) out.push({ title: heading[1], body: "" });
    else if (out.length > 0) (out.at(-1) as { body: string }).body += `${line}\n`;
  }
  return out;
}

/** A documented option appears as a table cell or inline code: `name`. */
const documents = (key: string): boolean => readme.includes(`\`${key}\``);

describe("README", () => {
  it("has the 12 outline sections as `##` headings, in order", () => {
    const titles = sections().map((s) => s.title);
    expect(titles).toEqual([
      "What it is",
      "Requirements",
      "Install",
      "Quick start",
      "Configuration reference",
      "Model options reference",
      "Actions",
      "Authentication modes and security",
      "Behavior notes",
      "Known limitations",
      "Development",
      "License",
    ]);
  });

  it("lists rate limiting under the Known limitations heading", () => {
    const section = sections().find((s) => s.title === "Known limitations");
    expect(section).toBeDefined();
    expect(section?.body).toMatch(/rate limiting/i);
  });

  it("lists the session revocation and request body size limits under Known limitations", () => {
    const section = sections().find((s) => s.title === "Known limitations");
    expect(section?.body).toMatch(/revoke/i);
    expect(section?.body).toMatch(/body size/i);
  });

  it("documents publicOrigin under a 'Deploying behind a reverse proxy' heading", () => {
    const match = /^### Deploying behind a reverse proxy$([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m.exec(
      readme,
    );
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain("publicOrigin");
  });

  it("documents the language choice under a 'Language' heading", () => {
    const match = /^### Language$([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m.exec(readme);
    expect(match).not.toBeNull();
    for (const text of ["da_lang", "Accept-Language", "English"]) {
      expect(match?.[1], text).toContain(text);
    }
  });

  it("states the language limitation under Known limitations", () => {
    const section = sections().find((s) => s.title === "Known limitations");
    expect(section?.body).toContain("English and Japanese only");
  });

  it("documents the reserved slug `_lang`", () => {
    expect(documents("_lang")).toBe(true);
  });

  it.each(ADMIN_CONFIG_KEYS)("documents the AdminConfig field %s", (key) => {
    expect(documents(key)).toBe(true);
  });

  it.each(AUTH_CONFIG_KEYS)("documents the AuthConfig field %s", (key) => {
    expect(documents(key)).toBe(true);
  });

  it.each(MODEL_OPTION_KEYS)("documents the ModelAdminOptions field %s", (key) => {
    expect(documents(key)).toBe(true);
  });

  it("documents each AdminConfig and ModelAdminOptions field inside its reference section", () => {
    const all = sections();
    const config = all.find((s) => s.title === "Configuration reference")?.body ?? "";
    const model = all.find((s) => s.title === "Model options reference")?.body ?? "";
    for (const key of [...ADMIN_CONFIG_KEYS, ...AUTH_CONFIG_KEYS]) {
      expect(config, key).toContain(`\`${key}\``);
    }
    for (const key of MODEL_OPTION_KEYS) expect(model, key).toContain(`\`${key}\``);
  });

  it("documents the example run instructions", () => {
    for (const text of [
      "mise install",
      "pnpm install",
      "pnpm example",
      "http://127.0.0.1:3000/admin/",
      "HOST=0.0.0.0",
    ]) {
      expect(readme).toContain(text);
    }
  });
});
