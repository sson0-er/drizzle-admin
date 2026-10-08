import { describe, expect, it } from "vitest";
import type { FormField } from "../src/forms/fields.js";
import { DisplayValue, toFormValue, Widget } from "../src/forms/widgets.js";
import type { FieldMeta } from "../src/introspect/index.js";
import { messages } from "../src/messages.js";
import type { WidgetType } from "../src/types.js";
import { FormPage, type FormPageProps } from "../src/views/form.js";
import type { PageChrome } from "../src/views/layout.js";
import { attr, type Element, parse, qs, qsa, text } from "./helpers/html.js";

const meta = (over: Partial<FieldMeta> = {}): FieldMeta => ({
  key: "f",
  dbName: "f",
  kind: "string",
  notNull: true,
  hasDefault: false,
  isPrimaryKey: false,
  isAutoIncrement: false,
  isInteger: false,
  isLongText: false,
  isDateOnly: false,
  isGenerated: false,
  ...over,
});

const field = (
  widget: WidgetType,
  metaOver: Partial<FieldMeta> = {},
  over: Partial<FormField> = {},
): FormField => ({
  key: "f",
  label: "f",
  meta: meta(metaOver),
  widget,
  editable: true,
  required: true,
  ...over,
});

const renderWidget = (f: FormField, value: string, error?: string) =>
  String(Widget({ field: f, value, error }));

/** Parses a fragment and returns the single form control with name `f`. */
function control(html: string, tag: string): Element {
  const el = qs(parse(html), { tag, attrs: { name: "f" } });
  if (el === null) throw new Error(`no <${tag} name=f> in ${html}`);
  return el;
}

describe("Widget", () => {
  it("renders a text input", () => {
    const el = control(renderWidget(field("text"), "abc"), "input");
    expect(attr(el, "type")).toBe("text");
    expect(attr(el, "value")).toBe("abc");
    expect(attr(el, "id")).toBe("id_f");
  });

  it("renders a password input that never contains the given value", () => {
    const html = renderWidget(field("password"), "stored");
    expect(attr(control(html, "input"), "type")).toBe("password");
    expect(html).not.toContain("stored");
  });

  it("uses step=1 for integer and bigint, step=any otherwise", () => {
    const step = (m: Partial<FieldMeta>) =>
      attr(control(renderWidget(field("number", m), "1"), "input"), "step");
    expect(
      attr(control(renderWidget(field("number", { kind: "number" }), "1"), "input"), "type"),
    ).toBe("number");
    expect(step({ kind: "number", isInteger: true })).toBe("1");
    expect(step({ kind: "bigint" })).toBe("1");
    expect(step({ kind: "number", isInteger: false })).toBe("any");
  });

  it("renders a textarea", () => {
    const el = control(renderWidget(field("textarea"), "line"), "textarea");
    expect(text(el)).toBe("line");
    expect(attr(el, "class")).toBeNull();
  });

  it("renders json as textarea.json", () => {
    const el = control(renderWidget(field("json", { kind: "json" }), '{"a":1}'), "textarea");
    expect(attr(el, "class")).toBe("json");
    expect(text(el)).toBe('{"a":1}');
  });

  it("checks the checkbox only for 'on'", () => {
    const f = field("checkbox", { kind: "boolean" });
    const on = control(renderWidget(f, "on"), "input");
    expect(attr(on, "type")).toBe("checkbox");
    expect(attr(on, "checked")).not.toBeNull();
    for (const v of ["", "true", "1", "off"]) {
      expect(attr(control(renderWidget(f, v), "input"), "checked")).toBeNull();
    }
  });

  it("renders a select with the matching option selected", () => {
    const f = field(
      "select",
      { kind: "enum" },
      {
        choices: [
          { value: "", label: "---------" },
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
    );
    const select = control(renderWidget(f, "b"), "select");
    const options = qsa(select, { tag: "option" });
    expect(options.map((o) => attr(o, "value"))).toEqual(["", "a", "b"]);
    expect(options.map((o) => attr(o, "selected") !== null)).toEqual([false, false, true]);
    expect(text(options[2] as Element)).toBe("B");
  });

  it("renders date and datetime-local inputs", () => {
    const date = control(
      renderWidget(field("date", { kind: "date", isDateOnly: true }), "2026-10-07"),
      "input",
    );
    expect(attr(date, "type")).toBe("date");
    expect(attr(date, "value")).toBe("2026-10-07");
    const dt = control(
      renderWidget(field("datetime", { kind: "date" }), "2026-10-07T09:30"),
      "input",
    );
    expect(attr(dt, "type")).toBe("datetime-local");
    expect(attr(dt, "value")).toBe("2026-10-07T09:30");
  });

  it("renders a hidden input", () => {
    const el = control(renderWidget(field("hidden"), "7"), "input");
    expect(attr(el, "type")).toBe("hidden");
    expect(attr(el, "value")).toBe("7");
  });

  it("uses name=<key> and id=id_<key> and never emits required", () => {
    const widgets: [WidgetType, Partial<FieldMeta>][] = [
      ["text", {}],
      ["password", {}],
      ["number", { kind: "number" }],
      ["textarea", {}],
      ["json", { kind: "json" }],
      ["checkbox", { kind: "boolean" }],
      ["select", { kind: "enum" }],
      ["date", { kind: "date", isDateOnly: true }],
      ["datetime", { kind: "date" }],
      ["hidden", {}],
    ];
    for (const [widget, m] of widgets) {
      const f = { ...field(widget, m), key: "title", required: true };
      const html = renderWidget(f, "");
      const el = qs(parse(html), { attrs: { name: "title" } });
      expect(el, widget).not.toBeNull();
      expect(attr(el as Element, "id"), widget).toBe("id_title");
      expect(html, widget).not.toContain("required");
    }
  });

  it("renders an error list before the input", () => {
    const html = renderWidget(field("text"), "", "bad <value>");
    const doc = parse(html);
    const li = qs(doc, { tag: "li" });
    expect(li === null ? null : text(li)).toBe("bad <value>");
    expect(qsa(doc, { tag: "ul", cls: "errorlist" })).toHaveLength(1);
    expect(html.indexOf("errorlist")).toBeLessThan(html.indexOf("<input"));
    expect(qsa(parse(renderWidget(field("text"), "")), { tag: "ul" })).toHaveLength(0);
  });

  it("renders the fallback link and hint for fkFallbackHref", () => {
    const f = field("number", { kind: "number" }, { fkFallbackHref: "/admin/authors/" });
    const doc = parse(renderWidget(f, "3"));
    const a = qs(doc, { tag: "a" });
    expect(a === null ? null : attr(a, "href")).toBe("/admin/authors/");
    expect(a === null ? null : text(a)).toBe(messages.openRelated);
    expect(text(doc)).toContain(messages.fkTooMany);
    expect(qs(parse(renderWidget(field("number"), "3")), { tag: "a" })).toBeNull();
  });
});

describe("toFormValue", () => {
  const tokyo = "Asia/Tokyo";
  const ny = "America/New_York";

  it("converts a date-only UTC midnight to YYYY-MM-DD in any zone", () => {
    const f = field("date", { kind: "date", isDateOnly: true });
    const v = new Date(Date.UTC(2026, 9, 7));
    expect(toFormValue(f, v, tokyo)).toBe("2026-10-07");
    expect(toFormValue(f, v, ny)).toBe("2026-10-07");
  });

  it("passes a date-only string through", () => {
    const f = field("date", { kind: "string", isDateOnly: true });
    expect(toFormValue(f, "2026-10-07", tokyo)).toBe("2026-10-07");
  });

  it("converts a timestamp to datetime-local in the zone", () => {
    const f = field("datetime", { kind: "date" });
    const v = new Date("2026-10-07T00:30:00Z");
    expect(toFormValue(f, v, tokyo)).toBe("2026-10-07T09:30");
    expect(toFormValue(f, v, ny)).toBe("2026-10-06T20:30");
  });

  it("maps booleans to on / empty", () => {
    const f = field("checkbox", { kind: "boolean" });
    expect(toFormValue(f, true, tokyo)).toBe("on");
    expect(toFormValue(f, false, tokyo)).toBe("");
  });

  it("pretty-prints json", () => {
    const f = field("json", { kind: "json" });
    expect(toFormValue(f, { a: 1 }, tokyo)).toBe('{\n  "a": 1\n}');
  });

  it("stringifies numbers and bigints", () => {
    expect(toFormValue(field("number", { kind: "bigint" }), 9007199254740993n, tokyo)).toBe(
      "9007199254740993",
    );
    expect(toFormValue(field("number", { kind: "number" }), 1.5, tokyo)).toBe("1.5");
  });

  it("returns an empty string for null and undefined", () => {
    const f = field("text");
    expect(toFormValue(f, null, tokyo)).toBe("");
    expect(toFormValue(f, undefined, tokyo)).toBe("");
  });

  it("returns strings unchanged", () => {
    expect(toFormValue(field("text"), "hello", tokyo)).toBe("hello");
  });

  it("still converts by meta when a date field is overridden to text", () => {
    const dateOnly = field("text", { kind: "date", isDateOnly: true });
    expect(toFormValue(dateOnly, new Date(Date.UTC(2026, 9, 7)), ny)).toBe("2026-10-07");
    const ts = field("text", { kind: "date" });
    expect(toFormValue(ts, new Date("2026-10-07T00:30:00Z"), tokyo)).toBe("2026-10-07T09:30");
  });
});

describe("DisplayValue", () => {
  const render = (f: FormField, value: unknown) =>
    text(parse(String(DisplayValue({ field: f, value, timeZone: "Asia/Tokyo" }))));

  it("renders formatted text", () => {
    expect(render(field("text"), "abc")).toBe("abc");
    expect(render(field("text"), null)).toBe("-");
    expect(render(field("checkbox", { kind: "boolean" }), true)).toBe(messages.yes);
    expect(render(field("datetime", { kind: "date" }), new Date("2026-10-07T00:30:00Z"))).toBe(
      "2026/10/07 09:30",
    );
  });

  const dateOnly = field("date", { kind: "date", isDateOnly: true });
  const json = field("json", { kind: "json" });
  it.each([
    {
      zone: "Asia/Tokyo",
      name: "date-only Date",
      field: dateOnly,
      value: new Date("2026-10-07T00:00:00Z"),
      expected: "2026/10/07",
    },
    {
      zone: "America/New_York",
      name: "date-only Date",
      field: dateOnly,
      value: new Date("2026-10-07T00:00:00Z"),
      expected: "2026/10/07",
    },
    { zone: "Asia/Tokyo", name: "json value", field: json, value: { a: 1 }, expected: '{"a":1}' },
    {
      zone: "America/New_York",
      name: "json value",
      field: json,
      value: { a: 1 },
      expected: '{"a":1}',
    },
  ])("shows a $name the same in $zone", ({ zone, field: f, value, expected }) => {
    expect(text(parse(String(DisplayValue({ field: f, value, timeZone: zone }))))).toBe(expected);
  });

  it("masks a password-widget field", () => {
    const html = String(
      DisplayValue({ field: field("password"), value: "stored", timeZone: "UTC" }),
    );
    expect(text(parse(html))).toBe("********");
    expect(html).not.toContain("stored");
  });

  const boolean = field("checkbox", { kind: "boolean" });
  const html = (f: FormField, value: unknown) =>
    parse(String(DisplayValue({ field: f, value, timeZone: "UTC" })));

  it.each([
    { value: true, icon: "check", message: messages.yes },
    { value: false, icon: "x", message: messages.no },
  ])("renders $value as a boolean mark inside span.readonly", ({ value, icon, message }) => {
    const doc = html(boolean, value);
    const readonly = qs(doc, { tag: "span", cls: "readonly" }) as Element;
    const mark = qsa(readonly, { tag: "span", cls: "boolean-mark" });
    expect(mark).toHaveLength(1);
    expect(attr(mark[0] as Element, "data-bool")).toBe(String(value));
    expect(qsa(mark[0] as Element, { tag: "svg", attrs: { "data-icon": icon } })).toHaveLength(1);
    expect(text(qs(mark[0] as Element, { cls: "visually-hidden" }) as Element)).toBe(message);
  });

  it("shows - and no svg for null on a boolean field", () => {
    const doc = html(boolean, null);
    expect(text(doc)).toBe("-");
    expect(qsa(doc, { tag: "svg" })).toEqual([]);
  });

  it("masks a password-widget field holding true without a mark", () => {
    const doc = html({ ...boolean, widget: "password" }, true);
    expect(text(doc)).toBe("********");
    expect(qsa(doc, { tag: "svg" })).toEqual([]);
  });

  it("escapes markup", () => {
    const html = String(DisplayValue({ field: field("text"), value: "<b>x</b>", timeZone: "UTC" }));
    expect(html).not.toContain("<b>");
  });
});

describe("FormPage", () => {
  const chrome: PageChrome = {
    siteTitle: "Site",
    prefix: "/admin",
    title: "Add author",
    user: null,
    showLogout: false,
    csrfToken: "tok123",
    flash: [],
    breadcrumbs: [{ label: "Home", href: "/admin/" }],
  };
  const name = { ...field("text"), key: "name", label: "name" };
  const id = { ...field("number", { kind: "number" }), key: "id", label: "id", editable: false };
  const secret = { ...field("hidden"), key: "token", label: "token" };
  const base: FormPageProps = {
    mode: "change",
    modelLabel: "Author",
    groups: [
      { title: "Main", fields: [id, name, secret] },
      { fields: [{ ...field("textarea"), key: "bio", label: "bio" }] },
    ],
    values: { name: "Ann", token: "t" },
    fieldErrors: {},
    formErrors: [],
    canSave: true,
    displayRow: { id: 5 },
    timeZone: "Asia/Tokyo",
  };
  const render = (over: Partial<FormPageProps> = {}) =>
    parse(String(FormPage({ ...chrome, ...base, ...over })));

  it("renders the form, groups and rows", () => {
    const doc = render();
    const form = qs(doc, { tag: "form", id: "model-form" });
    expect(form).not.toBeNull();
    expect(form === null ? null : attr(form, "method")).toBe("post");
    const sets = qsa(doc, { tag: "fieldset", cls: "module" });
    expect(sets).toHaveLength(2);
    expect(text(qs(sets[0] as Element, { tag: "h2" }) as Element)).toBe("Main");
    expect(qs(sets[1] as Element, { tag: "h2" })).toBeNull();
    const rows = qsa(doc, { tag: "div", cls: "form-row" }).map((r) => attr(r, "data-field"));
    expect(rows).toEqual(["id", "name", "bio"]);
  });

  it("renders display-only fields as text and hidden fields without a row", () => {
    const doc = render();
    const idRow = qs(doc, { tag: "div", attrs: { "data-field": "id" } }) as Element;
    expect(text(idRow)).toContain("5");
    expect(qs(idRow, { tag: "input" })).toBeNull();
    const hidden = qs(doc, { tag: "input", attrs: { name: "token" } }) as Element;
    expect(attr(hidden, "type")).toBe("hidden");
    expect(attr(hidden, "value")).toBe("t");
    expect(qs(doc, { tag: "div", attrs: { "data-field": "token" } })).toBeNull();
  });

  it("fills the widget with the given value", () => {
    const input = qs(render(), { tag: "input", attrs: { name: "name" } }) as Element;
    expect(attr(input, "value")).toBe("Ann");
  });

  it("shows p.errornote only when there are errors", () => {
    expect(qs(render(), { tag: "p", cls: "errornote" })).toBeNull();
    expect(qs(render(), { tag: "ul", cls: "errorlist" })).toBeNull();

    const withField = render({ fieldErrors: { name: messages.required } });
    expect(qs(withField, { tag: "p", cls: "errornote" })).not.toBeNull();
    const row = qs(withField, { tag: "div", attrs: { "data-field": "name" } }) as Element;
    expect(text(qs(row, { tag: "ul", cls: "errorlist" }) as Element)).toBe(messages.required);

    const withForm = render({ formErrors: [messages.hookFailed] });
    expect(qs(withForm, { tag: "p", cls: "errornote" })).not.toBeNull();
    expect(text(qs(withForm, { tag: "ul", cls: "errorlist" }) as Element)).toBe(
      messages.hookFailed,
    );
  });

  it("shows the three save buttons only when canSave", () => {
    const names = (doc: ReturnType<typeof render>) =>
      qsa(doc, { tag: "button" })
        .map((b) => attr(b, "name"))
        .filter((n) => n !== null);
    expect(names(render())).toEqual(["_save", "_addanother", "_continue"]);
    expect(names(render({ canSave: false }))).toEqual([]);
  });

  it("shows a.deletelink only with deleteHref", () => {
    expect(qs(render(), { tag: "a", cls: "deletelink" })).toBeNull();
    const a = qs(render({ deleteHref: "/admin/authors/5/delete/" }), {
      tag: "a",
      cls: "deletelink",
    });
    expect(a === null ? null : attr(a, "href")).toBe("/admin/authors/5/delete/");
  });

  it("contains a hidden _csrf input inside the form", () => {
    const form = qs(render(), { tag: "form", id: "model-form" }) as Element;
    const csrf = qs(form, { tag: "input", attrs: { name: "_csrf" } }) as Element;
    expect(attr(csrf, "type")).toBe("hidden");
    expect(attr(csrf, "value")).toBe("tok123");
  });
});
