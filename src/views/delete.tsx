import { messages } from "../messages.js";
import { Icon } from "./icons.js";
import { Layout, type PageChrome } from "./layout.js";

export interface DeletePageProps {
  modelLabel: string;
  objectLabel: string;
  cancelHref: string;
}

export function DeletePage(props: PageChrome & DeletePageProps) {
  return (
    <Layout {...props}>
      <h1>{props.title}</h1>
      <form id="delete-form" method="post">
        <input type="hidden" name="_csrf" value={props.csrfToken} />
        <p class="confirm-text">{messages.confirmDelete(props.objectLabel)}</p>
        <div class="submit-row">
          <button type="submit">
            <Icon name="trash" />
            {messages.confirmYes}
          </button>
          <a href={props.cancelHref}>
            <Icon name="x" />
            {messages.cancel}
          </a>
        </div>
      </form>
    </Layout>
  );
}
