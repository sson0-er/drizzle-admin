import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
  MESSAGES,
} from "../src/messages.js";

const stringKeys = [
  "defaultSiteTitle",
  "home",
  "add",
  "change",
  "delete",
  "logout",
  "language",
  "search",
  "searchPlaceholder",
  "filter",
  "all",
  "yes",
  "no",
  "today",
  "past7",
  "thisMonth",
  "thisYear",
  "action",
  "run",
  "selectAll",
  "deleteSelected",
  "noSelection",
  "unknownAction",
  "save",
  "saveAndAddAnother",
  "saveAndContinue",
  "required",
  "invalidNumber",
  "invalidInteger",
  "invalidDate",
  "invalidJson",
  "invalidChoice",
  "invalidValue",
  "formHasErrors",
  "fkTooMany",
  "openRelated",
  "actionDone",
  "afterSaveFailed",
  "dbUnique",
  "dbForeignKey",
  "dbNotNull",
  "dbOther",
  "hookFailed",
  "actionFailed",
  "confirmYes",
  "cancel",
  "login",
  "username",
  "password",
  "loginFailed",
  "forbidden",
  "notFound",
  "unauthorized",
  "serverError",
  "csrfFailed",
  "binary",
] as const;

const functionKeys = [
  "resultCount",
  "added",
  "changed",
  "deleted",
  "alreadyDeleted",
  "deletedMany",
  "confirmDelete",
  "confirmAction",
  "tooManySelected",
] as const;

type FormatRow = [Locale, (typeof functionKeys)[number], string | number, string];

const formatted: FormatRow[] = [
  ["en", "resultCount", 1, "1 result"],
  ["en", "resultCount", 3, "3 results"],
  ["en", "deletedMany", 1, "Deleted 1 item."],
  ["en", "deletedMany", 2, "Deleted 2 items."],
  ["en", "added", "x", "“x” was added."],
  ["en", "tooManySelected", 500, "At most 500 items can be selected at once."],
  ["ja", "resultCount", 3, "3 件"],
  ["ja", "added", "x", "「x」を追加しました。"],
  ["ja", "changed", "x", "「x」を変更しました。"],
  ["ja", "deleted", "x", "「x」を削除しました。"],
  ["ja", "alreadyDeleted", "x", "「x」は既に削除されています。"],
  ["ja", "deletedMany", 2, "2 件削除しました。"],
  ["ja", "confirmDelete", "x", "「x」を削除してもよろしいですか?"],
  ["ja", "confirmAction", "y", "「y」を実行してもよろしいですか?"],
  ["ja", "tooManySelected", 500, "一度に操作できるのは 500 件までです。"],
];

describe.each(LOCALES)("MESSAGES.%s", (locale) => {
  const messages = MESSAGES[locale];

  it.each(stringKeys)("has a non-empty string for %s", (key) => {
    expect(typeof messages[key]).toBe("string");
    expect(messages[key].length).toBeGreaterThan(0);
  });

  it.each(functionKeys)("has a function for %s", (key) => {
    expect(typeof messages[key]).toBe("function");
  });

  it("has no keys beyond the ones listed in support.md", () => {
    expect(Object.keys(messages).sort()).toEqual([...stringKeys, ...functionKeys].sort());
  });
});

describe("formatted messages", () => {
  it.each(formatted)("%s %s(%j) is %j", (locale, key, arg, expected) => {
    const fn = MESSAGES[locale][key] as (a: string | number) => string;
    expect(fn(arg)).toBe(expected);
  });
});

describe("locale helpers", () => {
  it.each([
    { value: "en", expected: true },
    { value: "ja", expected: true },
    { value: "fr", expected: false },
    { value: "JA", expected: false },
    { value: "ja ", expected: false },
    { value: "", expected: false },
    { value: undefined, expected: false },
    { value: 1, expected: false },
  ])("isLocale($value) is $expected", ({ value, expected }) => {
    expect(isLocale(value)).toBe(expected);
  });

  it("pins the default, the switcher order and the endonyms", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toEqual(["en", "ja"]);
    expect(LOCALE_NAMES).toEqual({ en: "English", ja: "日本語" });
  });
});

describe("source guard", () => {
  const srcDir = join(import.meta.dirname, "..", "src");
  const files = (readdirSync(srcDir, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({ file: f.replaceAll("\\", "/"), source: readFileSync(join(srcDir, f), "utf8") }));

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("keeps Japanese characters in src/messages.ts only", () => {
    const offenders = files
      .filter((f) => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(f.source))
      .map((f) => f.file);
    expect(offenders).toEqual(["messages.ts"]);
  });

  it("names MESSAGES only in src/messages.ts and src/routes/middleware.ts", () => {
    const offenders = files.filter((f) => /\bMESSAGES\b/.test(f.source)).map((f) => f.file);
    expect(offenders.sort()).toEqual(["messages.ts", "routes/middleware.ts"]);
  });
});
