import { describe, expect, it } from "vitest";
import {
  calendarPresetRange,
  datePresetRange,
  formatDate,
  formatDateTime,
  parseDateOnly,
  parseDatetimeLocal,
  resolveTimeZone,
  toDateOnly,
  toDatetimeLocal,
  zonedParts,
  zonedToInstant,
} from "../src/time.js";

const TOKYO = "Asia/Tokyo";
const NY = "America/New_York";
const iso = (d: Date | null) => d?.toISOString();
const range = (r: { start: Date; end: Date }) => [r.start.toISOString(), r.end.toISOString()];

describe("resolveTimeZone", () => {
  it("returns a valid zone unchanged", () => {
    expect(resolveTimeZone(TOKYO)).toBe(TOKYO);
  });

  it("falls back to the runtime zone when undefined", () => {
    expect(resolveTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("throws for an invalid zone", () => {
    expect(() => resolveTimeZone("Nope/Zone")).toThrow(
      'drizzle-admin: invalid timeZone "Nope/Zone"',
    );
    expect(() => resolveTimeZone("Nope/Zone")).toThrow(/drizzle-admin: invalid timeZone/);
  });
});

describe("zonedParts", () => {
  it("reads wall-clock parts in the zone, with midnight as hour 0", () => {
    expect(zonedParts(new Date("2026-10-07T05:05:09Z"), TOKYO)).toEqual({
      y: 2026,
      mo: 10,
      d: 7,
      h: 14,
      mi: 5,
      s: 9,
    });
    expect(zonedParts(new Date("2026-10-06T15:00:00Z"), TOKYO)).toMatchObject({ d: 7, h: 0 });
  });
});

describe("zonedToInstant", () => {
  it("defaults the time fields to midnight", () => {
    expect(iso(zonedToInstant({ y: 2026, mo: 10, d: 7 }, TOKYO))).toBe("2026-10-06T15:00:00.000Z");
  });
});

describe("parseDatetimeLocal / toDatetimeLocal", () => {
  it("round-trips in Asia/Tokyo", () => {
    const d = parseDatetimeLocal("2026-10-07T14:05", TOKYO);
    expect(iso(d)).toBe("2026-10-07T05:05:00.000Z");
    expect(toDatetimeLocal(d as Date, TOKYO)).toBe("2026-10-07T14:05");
  });

  it("round-trips in America/New_York", () => {
    const d = parseDatetimeLocal("2026-10-07T14:05", NY);
    expect(iso(d)).toBe("2026-10-07T18:05:00.000Z");
    expect(toDatetimeLocal(d as Date, NY)).toBe("2026-10-07T14:05");
  });

  it("accepts optional seconds", () => {
    expect(iso(parseDatetimeLocal("2026-10-07T14:05:09", TOKYO))).toBe("2026-10-07T05:05:09.000Z");
  });

  it("maps a DST gap to the later valid instant (west of UTC)", () => {
    // 2026-03-08 02:30 does not exist in New York; clocks jump 02:00 EST -> 03:00 EDT.
    const d = parseDatetimeLocal("2026-03-08T02:30", NY);
    expect(iso(d)).toBe("2026-03-08T07:30:00.000Z");
    expect(toDatetimeLocal(d as Date, NY)).toBe("2026-03-08T03:30");
  });

  it("maps a DST gap to the later valid instant (east of UTC)", () => {
    // 2026-03-29 02:30 does not exist in Berlin; clocks jump 02:00 CET -> 03:00 CEST.
    expect(iso(parseDatetimeLocal("2026-03-29T02:30", "Europe/Berlin"))).toBe(
      "2026-03-29T01:30:00.000Z",
    );
  });

  it("maps a DST overlap to the first occurrence (west of UTC)", () => {
    // 2026-11-01 01:30 happens twice in New York: 05:30Z (EDT) and 06:30Z (EST).
    const d = parseDatetimeLocal("2026-11-01T01:30", NY);
    expect(iso(d)).toBe("2026-11-01T05:30:00.000Z");
    expect(toDatetimeLocal(new Date("2026-11-01T06:30:00Z"), NY)).toBe("2026-11-01T01:30");
  });

  it("maps a DST overlap to the first occurrence (east of UTC)", () => {
    // 2026-10-25 02:30 happens twice in Berlin: 00:30Z (CEST) and 01:30Z (CET).
    expect(iso(parseDatetimeLocal("2026-10-25T02:30", "Europe/Berlin"))).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("returns null for malformed or impossible values", () => {
    for (const bad of [
      "",
      "2026-10-07",
      "2026-10-07 14:05",
      "2026-10-07T14",
      "2026-10-07T14:05:9",
      "2026-10-07T14:05Z",
      "2026-13-01T00:00",
      "2026-02-30T00:00",
      "2026-10-07T24:00",
      "2026-10-07T12:60",
      "2026-10-07T12:00:60",
    ]) {
      expect(parseDatetimeLocal(bad, TOKYO), bad).toBeNull();
    }
  });
});

describe("date-only helpers", () => {
  it("parseDateOnly returns UTC midnight", () => {
    expect(parseDateOnly("2026-10-07")?.toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(parseDateOnly("2028-02-29")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("parseDateOnly returns null for malformed or impossible dates", () => {
    for (const bad of [
      "2026-13-01",
      "2026-02-30",
      "2027-02-29",
      "2026/10/07",
      "2026-10-7",
      "2026-10-07T00:00",
      "",
      " 2026-10-07",
      "2026-00-10",
      "2026-10-00",
    ]) {
      expect(parseDateOnly(bad), bad).toBeNull();
    }
  });

  it("toDateOnly and formatDate read UTC parts", () => {
    // Late evening UTC would be the next day in Tokyo; the UTC calendar date must win.
    const d = new Date("2026-10-07T23:59:59Z");
    expect(toDateOnly(d)).toBe("2026-10-07");
    expect(formatDate(d)).toBe("2026/10/07");
    expect(formatDate(new Date("2026-01-02T00:00:00Z"))).toBe("2026/01/02");
  });

  it("round-trips through parseDateOnly and toDateOnly", () => {
    expect(toDateOnly(parseDateOnly("2026-12-31") as Date)).toBe("2026-12-31");
  });
});

describe("formatDateTime", () => {
  it("formats as YYYY/MM/DD HH:mm in the zone", () => {
    const d = new Date("2026-10-07T05:05:00Z");
    expect(formatDateTime(d, TOKYO)).toBe("2026/10/07 14:05");
    expect(formatDateTime(d, NY)).toBe("2026/10/07 01:05");
  });

  it("zero-pads every field", () => {
    expect(formatDateTime(new Date("2026-01-02T03:04:00Z"), "UTC")).toBe("2026/01/02 03:04");
  });
});

describe("datePresetRange (instants in the zone)", () => {
  const now = new Date("2026-10-07T03:00:00Z"); // 2026-10-07 12:00 in Tokyo

  it("today", () => {
    expect(range(datePresetRange("today", now, TOKYO))).toEqual([
      "2026-10-06T15:00:00.000Z",
      "2026-10-07T15:00:00.000Z",
    ]);
  });

  it("past7", () => {
    expect(range(datePresetRange("past7", now, TOKYO))).toEqual([
      "2026-09-30T15:00:00.000Z",
      "2026-10-07T15:00:00.000Z",
    ]);
  });

  it("month", () => {
    expect(range(datePresetRange("month", now, TOKYO))).toEqual([
      "2026-09-30T15:00:00.000Z",
      "2026-10-31T15:00:00.000Z",
    ]);
  });

  it("year", () => {
    expect(range(datePresetRange("year", now, TOKYO))).toEqual([
      "2025-12-31T15:00:00.000Z",
      "2026-12-31T15:00:00.000Z",
    ]);
  });

  it("follows the zone, including DST offsets", () => {
    const nyNow = new Date("2026-10-07T16:00:00Z"); // 12:00 EDT
    expect(range(datePresetRange("today", nyNow, NY))).toEqual([
      "2026-10-07T04:00:00.000Z",
      "2026-10-08T04:00:00.000Z",
    ]);
    // The month ends at Nov 1 00:00 EDT, before the 2026-11-01 fall-back at 06:00Z.
    expect(range(datePresetRange("month", nyNow, NY))).toEqual([
      "2026-10-01T04:00:00.000Z",
      "2026-11-01T04:00:00.000Z",
    ]);
    expect(range(datePresetRange("year", nyNow, NY))).toEqual([
      "2026-01-01T05:00:00.000Z",
      "2027-01-01T05:00:00.000Z",
    ]);
  });

  it("handles month/year boundaries on Dec 31 and Jan 1 in the zone", () => {
    // 2026-12-31T15:00Z is already 2027-01-01 00:00 in Tokyo.
    const jan1 = new Date("2026-12-31T15:00:00Z");
    expect(range(datePresetRange("month", jan1, TOKYO))).toEqual([
      "2026-12-31T15:00:00.000Z",
      "2027-01-31T15:00:00.000Z",
    ]);
    expect(range(datePresetRange("past7", jan1, TOKYO))).toEqual([
      "2026-12-25T15:00:00.000Z",
      "2027-01-01T15:00:00.000Z",
    ]);
    const dec31 = new Date("2026-12-31T14:59:59Z"); // 23:59:59 on Dec 31 in Tokyo
    expect(range(datePresetRange("year", dec31, TOKYO))).toEqual([
      "2025-12-31T15:00:00.000Z",
      "2026-12-31T15:00:00.000Z",
    ]);
    expect(range(datePresetRange("month", dec31, TOKYO))).toEqual([
      "2026-11-30T15:00:00.000Z",
      "2026-12-31T15:00:00.000Z",
    ]);
  });
});

describe("calendarPresetRange (UTC-midnight calendar dates)", () => {
  it("today uses the calendar date of now in the zone", () => {
    const now = new Date("2026-10-06T16:00:00Z");
    expect(range(calendarPresetRange("today", now, TOKYO))).toEqual([
      "2026-10-07T00:00:00.000Z",
      "2026-10-08T00:00:00.000Z",
    ]);
    expect(range(calendarPresetRange("today", now, NY))).toEqual([
      "2026-10-06T00:00:00.000Z",
      "2026-10-07T00:00:00.000Z",
    ]);
  });

  it("past7, month and year", () => {
    const now = new Date("2026-10-07T03:00:00Z");
    expect(range(calendarPresetRange("past7", now, TOKYO))).toEqual([
      "2026-10-01T00:00:00.000Z",
      "2026-10-08T00:00:00.000Z",
    ]);
    expect(range(calendarPresetRange("month", now, TOKYO))).toEqual([
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    ]);
    expect(range(calendarPresetRange("year", now, TOKYO))).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
  });

  it("handles month and year boundaries", () => {
    // Dec 31 in New York (23:00 EST), while it is already Jan 1 in UTC and Tokyo.
    const now = new Date("2027-01-01T04:00:00Z");
    expect(range(calendarPresetRange("today", now, NY))).toEqual([
      "2026-12-31T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(range(calendarPresetRange("month", now, NY))).toEqual([
      "2026-12-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    expect(range(calendarPresetRange("year", now, NY))).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
    // Jan 1 in Tokyo: past7 reaches back into the previous year.
    expect(range(calendarPresetRange("past7", now, TOKYO))).toEqual([
      "2026-12-26T00:00:00.000Z",
      "2027-01-02T00:00:00.000Z",
    ]);
    expect(range(calendarPresetRange("year", now, TOKYO))).toEqual([
      "2027-01-01T00:00:00.000Z",
      "2028-01-01T00:00:00.000Z",
    ]);
  });

  it("feeds toDateOnly for string bounds", () => {
    const { start, end } = calendarPresetRange("today", new Date("2026-10-06T16:00:00Z"), TOKYO);
    expect([toDateOnly(start), toDateOnly(end)]).toEqual(["2026-10-07", "2026-10-08"]);
  });
});
