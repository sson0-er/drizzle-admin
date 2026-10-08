import { messages } from "../messages.js";
import { toDateOnly, toDatetimeLocal } from "../time.js";
import { formatValue } from "../views/format.js";
import type { FormField } from "./fields.js";

/**
 * Stored value to the string shown in an input. Selection is by `meta` only, never by widget, so a
 * `text` override on a date field still produces a date string (decisions 019, 021).
 */
export function toFormValue(field: FormField, value: unknown, timeZone: string): string {
  if (value === null || value === undefined) return "";
  const { kind, isDateOnly } = field.meta;
  switch (kind) {
    case "date":
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return "";
        return isDateOnly ? toDateOnly(value) : toDatetimeLocal(value, timeZone);
      }
      return String(value);
    case "boolean":
      return value === true ? "on" : "";
    case "json":
      // JSON.stringify returns undefined for functions and symbols.
      return JSON.stringify(value, null, 2) ?? "";
    case "number":
    case "bigint":
      return String(value);
    default:
      // A date-only string keeps its stored `YYYY-MM-DD` (decision 023).
      return typeof value === "string" ? value : String(value);
  }
}

// Glyph-only literal, not a message (decision 033 item 11).
const PASSWORD_MASK = "********";

export function DisplayValue(props: { field: FormField; value: unknown; timeZone: string }) {
  const { field, value, timeZone } = props;
  return (
    <span class="readonly">
      {field.widget === "password" ? PASSWORD_MASK : formatValue(field.meta, value, timeZone)}
    </span>
  );
}

function Input(props: { field: FormField; value: string }) {
  const { field, value } = props;
  const id = `id_${field.key}`;
  const name = field.key;
  // No `required` attribute anywhere, so server-side errors stay observable with plain requests.
  switch (field.widget) {
    case "password":
      // Never echo the value, not even on a 400 re-render (decision 037).
      return <input type="password" name={name} id={id} />;
    case "number":
      return (
        <input
          type="number"
          name={name}
          id={id}
          value={value}
          step={field.meta.isInteger || field.meta.kind === "bigint" ? "1" : "any"}
        />
      );
    case "textarea":
      return (
        <textarea name={name} id={id}>
          {value}
        </textarea>
      );
    case "json":
      return (
        <textarea name={name} id={id} class="json">
          {value}
        </textarea>
      );
    case "checkbox":
      return <input type="checkbox" name={name} id={id} checked={value === "on"} />;
    case "select":
      return (
        <select name={name} id={id}>
          {(field.choices ?? []).map((c) => (
            <option value={c.value} selected={c.value === value}>
              {c.label}
            </option>
          ))}
        </select>
      );
    case "date":
      return <input type="date" name={name} id={id} value={value} />;
    case "datetime":
      return <input type="datetime-local" name={name} id={id} value={value} />;
    case "hidden":
      return <input type="hidden" name={name} id={id} value={value} />;
    default:
      return <input type="text" name={name} id={id} value={value} />;
  }
}

export function Widget(props: { field: FormField; value: string; error?: string }) {
  const { field, value, error } = props;
  return (
    <>
      {error === undefined ? null : (
        <ul class="errorlist">
          <li>{error}</li>
        </ul>
      )}
      <Input field={field} value={value} />
      {field.fkFallbackHref === undefined ? null : (
        <>
          {" "}
          <a href={field.fkFallbackHref}>{messages.openRelated}</a>
          <p class="help">{messages.fkTooMany}</p>
        </>
      )}
    </>
  );
}
