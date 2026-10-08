import type { FlashLevel } from "../auth/flash.js";
import { messages } from "../messages.js";

export type IconName =
  | "plus"
  | "pencil"
  | "trash"
  | "check"
  | "x"
  | "search"
  | "logout"
  | "triangle-alert"
  | "circle-alert";

// Stroke-only path data on a 16x16 grid. Only path commands, digits, `.`, `-` and spaces: the
// strings are rendered into the `d` attribute and must never come from request, config or DB data.
export const ICON_PATHS: Readonly<Record<IconName, string>> = Object.freeze({
  plus: "M8 3v10M3 8h10",
  pencil: "M10.5 2.5l3 3L6 13H3v-3z",
  trash: "M2.5 4.5h11M6 4.5v-2h4v2M4 4.5l.75 9h6.5l.75-9",
  check: "M3 8.5l3.5 3.5L13 4.5",
  x: "M4 4l8 8M12 4l-8 8",
  search: "M11.5 7a4.5 4.5 0 1 1-9 0a4.5 4.5 0 1 1 9 0zM10.25 10.25L14 14",
  logout: "M6.5 2.5h-4v11h4M10 5l3 3-3 3M13 8H6",
  "triangle-alert": "M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.01",
  "circle-alert": "M14 8a6 6 0 1 1-12 0a6 6 0 1 1 12 0zM8 5v3.5M8 11v.01",
});

export const FLASH_ICONS: Readonly<Record<FlashLevel, IconName>> = Object.freeze({
  success: "check",
  warning: "triangle-alert",
  error: "circle-alert",
});

/** Decorative icon: no text node, hidden from assistive technology (decision 039). */
export function Icon(props: { name: IconName }) {
  const { name } = props;
  // Only reachable through a cast at a call site, but a real boundary (views.md "Icons", decision
  // 039): an inherited key such as "toString" would make `ICON_PATHS[name]` a function whose source
  // is rendered into `d`, so only own keys are accepted.
  if (!Object.hasOwn(ICON_PATHS, name)) return null;
  return (
    <svg
      class="icon"
      data-icon={name}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** Colored check / x with the answer as visually hidden text (decision 039). */
export function BooleanMark(props: { value: boolean }) {
  const { value } = props;
  return (
    <span class="boolean-mark" data-bool={value ? "true" : "false"}>
      <Icon name={value ? "check" : "x"} />
      <span class="visually-hidden">{value ? messages.yes : messages.no}</span>
    </span>
  );
}
