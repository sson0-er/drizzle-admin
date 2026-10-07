import { type DefaultTreeAdapterMap, parse as parse5 } from "parse5";

export type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];

export interface Query {
  tag?: string;
  id?: string;
  /** One or more space-separated classes; all must be present. */
  cls?: string;
  /** `true` only requires the attribute to be present (e.g. `hidden`). */
  attrs?: Record<string, string | true>;
}

export function parse(html: string): Node {
  return parse5(html);
}

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function matches(el: Element, q: Query): boolean {
  if (q.tag !== undefined && el.tagName !== q.tag) return false;
  if (q.id !== undefined && attr(el, "id") !== q.id) return false;
  if (q.cls !== undefined) {
    const have = (attr(el, "class") ?? "").split(/\s+/);
    if (!q.cls.split(/\s+/).every((c) => have.includes(c))) return false;
  }
  for (const [name, want] of Object.entries(q.attrs ?? {})) {
    const got = attr(el, name);
    if (got === null) return false;
    if (want !== true && got !== want) return false;
  }
  return true;
}

/** All descendant elements of `root` (document order) matching every given criterion. */
export function qsa(root: Node, q: Query): Element[] {
  const found: Element[] = [];
  const walk = (node: Node): void => {
    if (isElement(node) && matches(node, q)) found.push(node);
    if ("childNodes" in node) for (const child of node.childNodes) walk(child);
  };
  walk(root);
  return found;
}

export function qs(root: Node, q: Query): Element | null {
  return qsa(root, q)[0] ?? null;
}

/** Concatenated text of all descendant text nodes. */
export function text(node: Node): string {
  if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
  if (!("childNodes" in node)) return "";
  return node.childNodes.map(text).join("");
}

export function attr(node: Node, name: string): string | null {
  if (!isElement(node)) return null;
  return node.attrs.find((a) => a.name === name)?.value ?? null;
}
