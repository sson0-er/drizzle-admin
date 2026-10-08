import { jsx } from "hono/jsx";
import { describe, expect, it } from "vitest";
import type { FlashLevel } from "../src/auth/flash.js";
import { messages } from "../src/messages.js";
import { BooleanMark, FLASH_ICONS, ICON_PATHS, Icon, type IconName } from "../src/views/icons.js";
import { attr, type Element, parse, qs, qsa, text } from "./helpers/html.js";

const NAMES = Object.keys(ICON_PATHS) as IconName[];

const renderIcon = (name: IconName) => parse(String(Icon({ name })));

describe("ICON_PATHS", () => {
  it("has exactly the 9 icons of the design", () => {
    expect([...NAMES].sort()).toEqual(
      [
        "check",
        "circle-alert",
        "logout",
        "pencil",
        "plus",
        "search",
        "trash",
        "triangle-alert",
        "x",
      ].sort(),
    );
  });

  it.each(NAMES)("%s contains only path commands, digits, dots, minus and spaces", (name) => {
    expect(ICON_PATHS[name]).toMatch(/^[MmLlHhVvAaZz0-9 .-]+$/);
  });

  it("is frozen together with FLASH_ICONS", () => {
    expect(Object.isFrozen(ICON_PATHS)).toBe(true);
    expect(Object.isFrozen(FLASH_ICONS)).toBe(true);
  });
});

describe("FLASH_ICONS", () => {
  it.each([
    { level: "success", icon: "check" },
    { level: "warning", icon: "triangle-alert" },
    { level: "error", icon: "circle-alert" },
  ] as { level: FlashLevel; icon: IconName }[])("maps $level to $icon", ({ level, icon }) => {
    expect(FLASH_ICONS[level]).toBe(icon);
  });
});

describe("Icon", () => {
  it.each(NAMES)("renders %s as one decorative svg with one path", (name) => {
    const svgs = qsa(renderIcon(name), { tag: "svg" });
    expect(svgs).toHaveLength(1);
    const svg = svgs[0] as Element;
    expect(Object.fromEntries(svg.attrs.map((a) => [a.name, a.value]))).toMatchObject({
      class: "icon",
      "data-icon": name,
      "aria-hidden": "true",
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
    });
    const children = svg.childNodes.filter((n) => "tagName" in n);
    expect(children).toHaveLength(1);
    expect(children[0] && "tagName" in children[0] && children[0].tagName).toBe("path");
    expect(attr(children[0] as Element, "d")).toBe(ICON_PATHS[name]);
  });

  it.each(NAMES)("renders %s without text, style, href or event handler attributes", (name) => {
    const doc = renderIcon(name);
    const svg = qs(doc, { tag: "svg" }) as Element;
    expect(text(svg)).toBe("");
    const forbidden = qsa(svg, {})
      .flatMap((el) => el.attrs.map((a) => a.name))
      .filter((n) => n === "style" || n === "href" || n.startsWith("on"));
    expect(forbidden).toEqual([]);
  });

  it("returns null for an unknown name and renders no svg", () => {
    const unknown = "nope" as IconName;
    expect(Icon({ name: unknown })).toBeNull();
    const html = String(jsx("div", {}, Icon({ name: unknown })));
    expect(qsa(parse(html), { tag: "svg" })).toEqual([]);
  });

  it("returns null for a name inherited from Object.prototype", () => {
    expect(Icon({ name: "toString" as IconName })).toBeNull();
  });
});

describe("BooleanMark", () => {
  it.each([
    { value: true, icon: "check", message: messages.yes },
    { value: false, icon: "x", message: messages.no },
  ])("renders $value as $icon with the hidden text", ({ value, icon, message }) => {
    const mark = qs(parse(String(BooleanMark({ value }))), {
      tag: "span",
      cls: "boolean-mark",
      attrs: { "data-bool": String(value) },
    }) as Element;
    expect(mark).not.toBeNull();
    expect(qsa(mark, { tag: "svg", attrs: { "data-icon": icon } })).toHaveLength(1);
    const hidden = qsa(mark, { tag: "span", cls: "visually-hidden" });
    expect(hidden).toHaveLength(1);
    expect(text(hidden[0] as Element)).toBe(message);
    expect(text(mark)).toBe(message);
  });
});
