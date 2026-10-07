// Time-zone and date helpers built on Intl and UTC-only Date methods, so results never depend on
// the process time zone (decision 019). Local-time Date methods must not be used in this file.

export type DatePreset = "today" | "past7" | "month" | "year";

type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

const DAY_MS = 86_400_000;

export function resolveTimeZone(tz?: string): string {
  if (tz === undefined) return new Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error(`drizzle-admin: invalid timeZone "${tz}"`);
  }
  return tz;
}

// Date.UTC maps years 0-99 to 1900-1999, so set the full year explicitly.
function utcMs(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, 0);
  return date.getTime();
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function zonedParts(instant: Date, tz: string): Parts {
  const out: Record<string, number> = {};
  for (const part of formatterFor(tz).formatToParts(instant)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    y: out.year ?? 0,
    mo: out.month ?? 0,
    d: out.day ?? 0,
    h: out.hour ?? 0,
    mi: out.minute ?? 0,
    s: out.second ?? 0,
  };
}

// Offset of `tz` from UTC in ms at the given instant (whole seconds).
function offsetAt(ms: number, tz: string): number {
  const p = zonedParts(new Date(ms), tz);
  return utcMs(p.y, p.mo, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

export function zonedToInstant(
  p: { y: number; mo: number; d: number; h?: number; mi?: number; s?: number },
  tz: string,
): Date {
  const h = p.h ?? 0;
  const mi = p.mi ?? 0;
  const s = p.s ?? 0;
  const guess = utcMs(p.y, p.mo, p.d, h, mi, s);
  // The offsets one day before and after the guess are the offsets in force on either side of any
  // nearby transition. Each yields a candidate instant (a two-offset correction).
  const candidates = [
    ...new Set([guess - offsetAt(guess - DAY_MS, tz), guess - offsetAt(guess + DAY_MS, tz)]),
  ];
  const wantedLocal = guess;
  const valid = candidates.filter((c) => {
    const q = zonedParts(new Date(c), tz);
    return utcMs(q.y, q.mo, q.d, q.h, q.mi, q.s) === wantedLocal;
  });
  // Overlap (several valid instants) → first occurrence. Gap (none valid) → the later candidate,
  // which is the first valid instant after the gap.
  const result = valid.length > 0 ? Math.min(...valid) : Math.max(...candidates);
  return new Date(result);
}

// True when the numeric fields describe a real calendar date and clock time.
function isRealDateTime(y: number, mo: number, d: number, h: number, mi: number, s: number) {
  if (h > 23 || mi > 59 || s > 59) return false;
  const check = new Date(utcMs(y, mo, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 && check.getUTCDate() === d;
}

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDatetimeLocal(value: string, tz: string): Date | null {
  const m = DATETIME_LOCAL.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (!isRealDateTime(y, mo, d, h, mi, s)) return null;
  return zonedToInstant({ y, mo, d, h, mi, s }, tz);
}

export function parseDateOnly(value: string): Date | null {
  const m = DATE_ONLY.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  if (!isRealDateTime(y, mo, d, 0, 0, 0)) return null;
  return new Date(utcMs(y, mo, d));
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function toDatetimeLocal(instant: Date, tz: string): string {
  const p = zonedParts(instant, tz);
  return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

export function toDateOnly(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatDateTime(instant: Date, tz: string): string {
  const p = zonedParts(instant, tz);
  return `${pad(p.y, 4)}/${pad(p.mo)}/${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}

export function formatDate(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`;
}

export function calendarPresetRange(
  p: DatePreset,
  now: Date,
  tz: string,
): { start: Date; end: Date } {
  const { y, mo, d } = zonedParts(now, tz);
  // Date.UTC-style overflow (day 0, month 13, ...) normalizes the boundaries.
  switch (p) {
    case "today":
      return { start: new Date(utcMs(y, mo, d)), end: new Date(utcMs(y, mo, d + 1)) };
    case "past7":
      return { start: new Date(utcMs(y, mo, d - 6)), end: new Date(utcMs(y, mo, d + 1)) };
    case "month":
      return { start: new Date(utcMs(y, mo, 1)), end: new Date(utcMs(y, mo + 1, 1)) };
    case "year":
      return { start: new Date(utcMs(y, 1, 1)), end: new Date(utcMs(y + 1, 1, 1)) };
  }
}

export function datePresetRange(p: DatePreset, now: Date, tz: string): { start: Date; end: Date } {
  const range = calendarPresetRange(p, now, tz);
  const toInstant = (date: Date) =>
    zonedToInstant(
      { y: date.getUTCFullYear(), mo: date.getUTCMonth() + 1, d: date.getUTCDate() },
      tz,
    );
  return { start: toInstant(range.start), end: toInstant(range.end) };
}
