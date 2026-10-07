import { describe, expect, it } from "vitest";
import { messages } from "../src/messages.js";

const stringKeys = [
  "defaultSiteTitle",
  "home",
  "add",
  "change",
  "delete",
  "logout",
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
] as const;

const functionKeys = [
  "resultCount",
  "added",
  "changed",
  "deleted",
  "deletedMany",
  "confirmDelete",
  "confirmAction",
] as const;

describe("messages", () => {
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

  it("formats function-valued messages", () => {
    expect(messages.resultCount(3)).toBe("3 件");
    expect(messages.added("x")).toBe("「x」を追加しました。");
    expect(messages.changed("x")).toBe("「x」を変更しました。");
    expect(messages.deleted("x")).toBe("「x」を削除しました。");
    expect(messages.deletedMany(2)).toBe("2 件削除しました。");
    expect(messages.confirmDelete("x")).toBe("「x」を削除してもよろしいですか?");
    expect(messages.confirmAction("y")).toBe("「y」を実行してもよろしいですか?");
  });
});
