import { messages } from "../messages.js";
import { Layout, type PageChrome } from "./layout.js";

export function DashboardPage(
  props: PageChrome & { models: { slug: string; label: string; canAdd: boolean }[] },
) {
  const { prefix, models } = props;
  return (
    <Layout {...props}>
      <h1>{props.title}</h1>
      <div class="module">
        <table id="dashboard">
          <tbody>
            {models.map((m) => (
              <tr data-model={m.slug}>
                <th scope="row">{m.label}</th>
                <td>
                  {m.canAdd ? (
                    <a class="addlink" href={`${prefix}/${m.slug}/add/`}>
                      {messages.add}
                    </a>
                  ) : null}
                </td>
                <td>
                  <a class="changelink" href={`${prefix}/${m.slug}/`}>
                    {messages.change}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
