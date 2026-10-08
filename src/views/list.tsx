import { messages } from "../messages.js";
import { SELECT_ALL_SCRIPT } from "../static/select-all.js";
import { BooleanMark, Icon } from "./icons.js";
import { Layout, type PageChrome } from "./layout.js";
import type { SortState } from "./url.js";

export interface Cell {
  text: string;
  /** Change page link (listDisplayLinks) or FK link. */
  href?: string;
  /** Set for a plain boolean value: rendered as a `BooleanMark` instead of `text` (decision 039). */
  bool?: boolean;
}

export interface ListPageProps {
  model: { slug: string; label: string };
  columns: { key: string; sort: SortState; sortHref: string }[];
  rows: { pk: string; cells: Cell[] }[];
  /** null hides the search box. */
  q?: string | null;
  filters: {
    key: string;
    choices: { label: string; href: string; selected: boolean }[];
  }[];
  actions: { name: string; label: string }[];
  canAdd: boolean;
  page: number;
  pages: number;
  total: number;
  pageHref: (n: number) => string;
  /** The current query string including the leading "?", or "" when empty. */
  backQuery: string;
}

const WINDOW = 5;

// Up to WINDOW page numbers around the current page, kept inside 1..pages.
function pageWindow(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), pages - WINDOW + 1));
  const end = Math.min(pages, start + WINDOW - 1);
  const numbers: number[] = [];
  for (let n = start; n <= end; n++) numbers.push(n);
  return numbers;
}

function Paginator(props: Pick<ListPageProps, "page" | "pages" | "total" | "pageHref">) {
  const { page, pages, total, pageHref } = props;
  return (
    <p class="paginator">
      {page > 1 && pages >= 1 ? (
        <a class="prev" rel="prev" href={pageHref(Math.min(page - 1, pages))}>
          ‹
        </a>
      ) : null}
      {pageWindow(page, pages).map((n) =>
        n === page ? (
          <span class="this-page">{String(n)}</span>
        ) : (
          <a href={pageHref(n)}>{String(n)}</a>
        ),
      )}
      {page < pages ? (
        <a class="next" rel="next" href={pageHref(page + 1)}>
          ›
        </a>
      ) : null}
      <span class="result-count">{messages.resultCount(total)}</span>
    </p>
  );
}

export function ListPage(props: PageChrome & ListPageProps) {
  const { prefix, csrfToken, model, columns, rows, q, filters, actions, canAdd, backQuery } = props;
  const listUrl = `${prefix}/${model.slug}/`;
  return (
    <Layout {...props}>
      <h1>{props.title}</h1>
      {canAdd ? (
        <ul class="object-tools">
          <li>
            <a class="addlink" href={`${listUrl}add/`}>
              <Icon name="plus" />
              {messages.add}
            </a>
          </li>
        </ul>
      ) : null}
      <div id="changelist">
        <div class="changelist-form-container">
          {q === null ? null : (
            <form id="changelist-search" method="get" action={listUrl}>
              <input
                type="text"
                name="q"
                value={q ?? ""}
                placeholder={messages.searchPlaceholder}
              />
              <button type="submit">
                <Icon name="search" />
                {messages.search}
              </button>
            </form>
          )}
          <form id="changelist-form" method="post" action={`${listUrl}${backQuery}`}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            {actions.length > 0 ? (
              <div class="actions">
                <select name="action">
                  <option value="">{messages.action}</option>
                  {actions.map((a) => (
                    <option value={a.name}>{a.label}</option>
                  ))}
                </select>
                <button type="submit" name="index" value="0">
                  {messages.run}
                </button>
              </div>
            ) : null}
            <div class="results">
              <table id="result_list">
                <thead>
                  <tr>
                    <th class="action-checkbox-column">
                      <input
                        type="checkbox"
                        id="action-toggle"
                        aria-label={messages.selectAll}
                        hidden
                      />
                    </th>
                    {columns.map((c) => (
                      <th data-key={c.key} data-sort={c.sort}>
                        <a class="sort" href={c.sortHref}>
                          {c.key}
                        </a>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr>
                      <td class="action-checkbox">
                        <input type="checkbox" name="_selected" value={row.pk} />
                      </td>
                      {row.cells.map((cell) => {
                        const content =
                          cell.bool === undefined ? cell.text : <BooleanMark value={cell.bool} />;
                        return (
                          <td>
                            {cell.href === undefined ? content : <a href={cell.href}>{content}</a>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
          <Paginator
            page={props.page}
            pages={props.pages}
            total={props.total}
            pageHref={props.pageHref}
          />
        </div>
        {filters.length > 0 ? (
          <aside id="changelist-filter">
            <h2>{messages.filter}</h2>
            {filters.map((f) => (
              <div data-filter={f.key}>
                <h3>{f.key}</h3>
                <ul>
                  {f.choices.map((choice) => (
                    <li class={choice.selected ? "selected" : undefined}>
                      <a href={choice.href}>{choice.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        ) : null}
      </div>
      <script>{SELECT_ALL_SCRIPT}</script>
    </Layout>
  );
}
