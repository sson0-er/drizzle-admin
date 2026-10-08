import type { FormGroup } from "../forms/fields.js";
import { DisplayValue, Widget } from "../forms/widgets.js";
import { messages } from "../messages.js";
import { Icon } from "./icons.js";
import { Layout, type PageChrome } from "./layout.js";

export interface FormPageProps {
  mode: "add" | "change";
  modelLabel: string;
  groups: FormGroup[];
  /** Form strings by field key (already converted with `toFormValue` or echoed from the request). */
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formErrors: string[];
  /** False renders the page read-only: no save buttons. */
  canSave: boolean;
  deleteHref?: string;
  /** Stored row for display-only fields. */
  displayRow?: Record<string, unknown>;
  /** Zone used to show display-only date-times. */
  timeZone: string;
}

export function FormPage(props: PageChrome & FormPageProps) {
  const { csrfToken, groups, values, fieldErrors, formErrors, canSave, deleteHref, displayRow } =
    props;
  const hasErrors = formErrors.length > 0 || Object.keys(fieldErrors).length > 0;
  return (
    <Layout {...props}>
      <h1>{props.title}</h1>
      <form id="model-form" method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        {hasErrors ? <p class="errornote">{messages.formHasErrors}</p> : null}
        {formErrors.length > 0 ? (
          <ul class="errorlist nonfield">
            {formErrors.map((e) => (
              <li>{e}</li>
            ))}
          </ul>
        ) : null}
        {groups.map((group) => (
          <fieldset class="module">
            {group.title === undefined ? null : <h2>{group.title}</h2>}
            {group.fields.map((field) =>
              field.editable && field.widget === "hidden" ? (
                <Widget
                  field={field}
                  value={values[field.key] ?? ""}
                  error={fieldErrors[field.key]}
                />
              ) : (
                <div class="form-row" data-field={field.key}>
                  <label for={`id_${field.key}`} class={field.required ? "required" : undefined}>
                    {field.label}
                  </label>
                  {field.editable ? (
                    <Widget
                      field={field}
                      value={values[field.key] ?? ""}
                      error={fieldErrors[field.key]}
                    />
                  ) : (
                    <DisplayValue
                      field={field}
                      value={displayRow?.[field.key]}
                      timeZone={props.timeZone}
                    />
                  )}
                </div>
              ),
            )}
          </fieldset>
        ))}
        <div class="submit-row">
          {canSave ? (
            <>
              <button type="submit" name="_save">
                <Icon name="check" />
                {messages.save}
              </button>
              <button type="submit" name="_addanother">
                <Icon name="plus" />
                {messages.saveAndAddAnother}
              </button>
              <button type="submit" name="_continue">
                <Icon name="pencil" />
                {messages.saveAndContinue}
              </button>
            </>
          ) : null}
          {deleteHref === undefined ? null : (
            <a class="deletelink" href={deleteHref}>
              <Icon name="trash" />
              {messages.delete}
            </a>
          )}
        </div>
      </form>
    </Layout>
  );
}
