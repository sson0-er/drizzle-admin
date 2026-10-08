import { describe, expect, it } from "vitest";
import { ADMIN_CSS } from "../src/static/admin-css.js";

// The text inside the braces that follow the first occurrence of `start` (brace-balanced).
const block = (css: string, start: string): string => {
  const at = css.indexOf(start);
  if (at < 0) throw new Error(`not found: ${start}`);
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unbalanced block: ${start}`);
};

const tokens = (blockText: string): Map<string, string> =>
  new Map(
    [...blockText.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(([, name = "", value = ""]) => [
      name,
      value.trim(),
    ]),
  );

// The value of the first `prop: value;` declaration in a block.
const declaration = (blockText: string, prop: string): string => {
  const found = new RegExp(`${prop}:\\s*([^;]+);`).exec(blockText);
  if (!found) throw new Error(`no ${prop} declaration`);
  return found[1] ?? "";
};

// WCAG 2.x contrast ratio from relative luminance.
const contrast = (a: string, b: string): number => {
  const channel = (hex: string, at: number): number => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string): number =>
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  return (
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  );
};

const light = tokens(block(ADMIN_CSS, ":root"));
const dark = tokens(block(block(ADMIN_CSS, "@media (prefers-color-scheme: dark)"), ":root"));
const token = (map: Map<string, string>, name: string): string => {
  const value = map.get(`--${name}`);
  if (!value) throw new Error(`missing token ${name}`);
  return value;
};
const schemes = [
  { scheme: "light", map: light },
  { scheme: "dark", map: dark },
];

const TOKEN_NAMES = [
  "--body-bg",
  "--body-fg",
  "--body-quiet",
  "--border",
  "--border-hover",
  "--border-strong",
  "--danger",
  "--danger-active",
  "--danger-hover",
  "--danger-tint",
  "--error-fg",
  "--focus-fill",
  "--focus-halo",
  "--focus-outline",
  "--heading-fg",
  "--icon-success",
  "--icon-warning",
  "--link",
  "--link-hover",
  "--on-danger",
  "--on-focus-fill",
  "--on-primary",
  "--primary",
  "--primary-active",
  "--primary-hover",
  "--primary-tint",
  "--selected-bg",
  "--surface-alt",
];

type Pair = [fg: string, bg: string];
const textPairs: Pair[] = [
  ["body-fg", "body-bg"],
  ["body-fg", "surface-alt"],
  ["heading-fg", "body-bg"],
  ["heading-fg", "surface-alt"],
  ["body-quiet", "body-bg"],
  ["body-quiet", "surface-alt"],
  ["link", "body-bg"],
  ["link", "surface-alt"],
  ["body-fg", "selected-bg"],
  ["link", "selected-bg"],
  ["link-hover", "body-bg"],
  ["on-primary", "primary"],
  ["on-primary", "primary-hover"],
  ["on-primary", "primary-active"],
  ["primary", "body-bg"],
  ["primary-hover", "primary-tint"],
  ["on-danger", "danger"],
  ["on-danger", "danger-hover"],
  ["on-danger", "danger-active"],
  ["danger", "body-bg"],
  ["danger-hover", "danger-tint"],
  ["error-fg", "body-bg"],
  ["error-fg", "surface-alt"],
  ["on-focus-fill", "focus-fill"],
];
const nonTextPairs: Pair[] = [
  ["icon-success", "body-bg"],
  ["icon-success", "surface-alt"],
  ["error-fg", "body-bg"],
  ["error-fg", "surface-alt"],
  ["icon-warning", "body-bg"],
  ["border-strong", "body-bg"],
  ["focus-outline", "body-bg"],
  ["focus-outline", "surface-alt"],
  ["focus-outline", "focus-halo"],
];

describe("ADMIN_CSS structure", () => {
  it("defines the light :root before any @media", () => {
    expect(ADMIN_CSS.indexOf(":root")).toBeLessThan(ADMIN_CSS.indexOf("@media"));
  });

  it("sets color-scheme in the light block", () => {
    expect(block(ADMIN_CSS, ":root")).toContain("color-scheme: light dark");
  });

  it.each(schemes)("defines exactly the 28 tokens in the $scheme scheme", ({ map }) => {
    expect([...map.keys()].sort()).toEqual(TOKEN_NAMES);
  });

  it.each(schemes)("writes every $scheme token as lowercase 6-digit hex", ({ map }) => {
    for (const [name, value] of map) expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("ADMIN_CSS pinned values", () => {
  it.each([
    { name: "--primary", lightValue: "#0017c1", darkValue: "#9db7f9" },
    { name: "--focus-outline", lightValue: "#000000", darkValue: "#ffd43d" },
    { name: "--focus-halo", lightValue: "#ffd43d", darkValue: "#000000" },
    { name: "--focus-fill", lightValue: "#ffd43d", darkValue: "#ffd43d" },
    { name: "--danger", lightValue: "#ce0000", darkValue: "#ff7171" },
    { name: "--body-bg", lightValue: "#ffffff", darkValue: "#1a1a1a" },
  ])("$name is $lightValue / $darkValue", ({ name, lightValue, darkValue }) => {
    expect(light.get(name)).toBe(lightValue);
    expect(dark.get(name)).toBe(darkValue);
  });
});

describe("ADMIN_CSS contrast", () => {
  it("computes known ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBe(21);
    expect(contrast("#767676", "#ffffff").toFixed(2)).toBe("4.54");
  });

  it("lists the pairs of test-strategy.md one to one", () => {
    expect(textPairs).toHaveLength(24);
    expect(nonTextPairs).toHaveLength(9);
  });

  const cases = (pairs: Pair[]) =>
    schemes.flatMap(({ scheme, map }) =>
      pairs.map(([fg, bg]) => ({
        scheme,
        fg,
        bg,
        ratio: contrast(token(map, fg), token(map, bg)),
      })),
    );

  it.each(cases(textPairs))("text $fg on $bg is at least 4.5 ($scheme)", ({ ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases(nonTextPairs))("non-text $fg on $bg is at least 3 ($scheme)", ({ ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

describe("ADMIN_CSS typography", () => {
  it("sets the body typography", () => {
    const body = block(ADMIN_CSS, "body {");
    expect(body).toContain("font-size: 16px");
    expect(body).toContain("line-height: 1.7");
    expect(body).toContain("letter-spacing: 0.02em");
  });

  it("lists the Japanese font stack from Noto Sans JP to sans-serif", () => {
    const family = declaration(block(ADMIN_CSS, "body {"), "font-family");
    expect(family.startsWith('"Noto Sans JP"')).toBe(true);
    for (const name of ['"Hiragino Sans"', '"Yu Gothic UI"', "Meiryo", "system-ui"]) {
      expect(family).toContain(name);
    }
    expect(family.endsWith("sans-serif")).toBe(true);
  });

  it("makes the table denser than the body", () => {
    expect(block(ADMIN_CSS, "table {")).toContain("font-size: 14px");
  });
});

describe("ADMIN_CSS focus ring", () => {
  it("draws the ring on :focus-visible", () => {
    const ring = block(ADMIN_CSS, ":focus-visible {");
    expect(ring).toContain("outline: 4px solid var(--focus-outline)");
    expect(ring).toContain("outline-offset: 2px");
    expect(ring).toContain("box-shadow: 0 0 0 2px var(--focus-halo)");
  });

  it("fills focused links and the logout button", () => {
    expect(ADMIN_CSS).toContain(":is(a, #header button):focus-visible");
  });

  it.each([
    "a.deletelink:hover",
    ".paginator a:hover",
    "#changelist-filter .selected a",
    ".site-title:hover",
  ])("places the focus rules after %s and before the narrow block", (selector) => {
    const focus = ADMIN_CSS.indexOf(":focus-visible {");
    expect(focus).toBeGreaterThan(ADMIN_CSS.lastIndexOf(selector));
    expect(focus).toBeLessThan(ADMIN_CSS.indexOf("@media (max-width: 767px)"));
  });

  it("never removes the outline", () => {
    expect(ADMIN_CSS).not.toMatch(/outline:\s*(none|0)/);
  });
});

describe("ADMIN_CSS shapes", () => {
  it.each([
    {
      name: "flash message",
      rule: ".messagelist li {",
      needles: ["border: 3px solid", "border-radius: 12px"],
    },
    { name: "error note", rule: ".errornote {", needles: ["border-radius: 12px"] },
    {
      name: "text input",
      rule: "input[type=text], input[type=password]",
      needles: ["border-radius: 8px", "min-height: 48px"],
    },
    {
      name: "button",
      rule: "button, .button, .object-tools a.addlink {",
      needles: ["border-radius: 8px", "min-height: 48px"],
    },
  ])("the $name rule has its shape", ({ rule, needles }) => {
    const body = block(ADMIN_CSS, rule);
    for (const needle of needles) expect(body).toContain(needle);
  });
});

describe("ADMIN_CSS variant selectors", () => {
  it.each([
    "#changelist-search button",
    "button[name=index]",
    "button[name=_addanother]",
    "button[name=_continue]",
    "#header button",
    ".submit-row a:not(.deletelink)",
    "#delete-form button[type=submit]",
    "form.delete-action button[type=submit]",
    "a.deletelink",
    ".paginator .this-page",
    ".errorlist + input",
  ])("contains %s", (selector) => {
    expect(ADMIN_CSS).toContain(selector);
  });
});

describe("ADMIN_CSS exclusions", () => {
  it.each(["url(", "@import", "@font-face", "http", ".dads-", "--color-primitive-"])(
    "does not contain %s",
    (text) => {
      expect(ADMIN_CSS).not.toContain(text);
    },
  );

  it.each(["#417690", "#79aec8", "#447e9b", "#ba2121", "#264b5d"])(
    "does not contain the v1 value %s",
    (value) => {
      expect(ADMIN_CSS).not.toContain(value);
    },
  );

  it("does not name DADS or the Digital Agency", () => {
    expect(ADMIN_CSS).not.toMatch(/dads/i);
    expect(ADMIN_CSS).not.toMatch(/digital agency/i);
  });
});
