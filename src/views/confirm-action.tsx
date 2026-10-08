import { Icon } from "./icons.js";
import { Layout, type PageChrome } from "./layout.js";

export interface ConfirmActionPageProps {
  modelLabel: string;
  /** The `action` field value the confirmation re-submits. */
  action: string;
  actionLabel: string;
  /** The built-in delete: the page is the same, only marked (callers pass the delete label). */
  isDelete: boolean;
  items: { pk: string; label: string }[];
  /** The list URL (the action form posts there; there is no model slug in the chrome). */
  listHref: string;
  /** The list's query string including the leading "?", or "" when empty. */
  backQuery: string;
}

export function ConfirmActionPage(props: PageChrome & ConfirmActionPageProps) {
  const { t, action, actionLabel, isDelete, items, listHref, backQuery, csrfToken } = props;
  return (
    <Layout {...props}>
      <h1>{props.title}</h1>
      <form
        id="action-confirm"
        method="post"
        class={isDelete ? "delete-action" : undefined}
        action={`${listHref}${backQuery}`}
      >
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="_confirm" value="1" />
        {items.map((item) => (
          <input type="hidden" name="_selected" value={item.pk} />
        ))}
        <p class="confirm-text">{t.confirmAction(actionLabel)}</p>
        <ul class="objects">
          {items.map((item) => (
            <li>{item.label}</li>
          ))}
        </ul>
        <div class="submit-row">
          <button type="submit">
            <Icon name={isDelete ? "trash" : "check"} />
            {t.confirmYes}
          </button>
          <a href={`${listHref}${backQuery}`}>
            <Icon name="x" />
            {t.cancel}
          </a>
        </div>
      </form>
    </Layout>
  );
}
