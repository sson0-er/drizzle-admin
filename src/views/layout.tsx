import type { Child } from "hono/jsx";
import type { FlashMessage } from "../auth/flash.js";
import { messages } from "../messages.js";
import { ADMIN_CSS_VERSION } from "../static/admin-css.js";
import type { AdminUser } from "../types.js";

export interface PageChrome {
  siteTitle: string;
  prefix: string;
  title: string;
  user: AdminUser | null;
  /** True in builtin auth mode when a user is logged in. */
  showLogout: boolean;
  csrfToken: string;
  flash: FlashMessage[];
  /** The first item is always Home -> `${prefix}/`. */
  breadcrumbs: { label: string; href?: string }[];
}

export function Layout(props: PageChrome & { children?: Child }) {
  const { siteTitle, prefix, title, user, showLogout, csrfToken, flash, breadcrumbs } = props;
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {title} | {siteTitle}
        </title>
        <link rel="stylesheet" href={`${prefix}/static/admin.css?v=${ADMIN_CSS_VERSION}`} />
      </head>
      <body>
        <header id="header">
          <a class="site-title" href={`${prefix}/`}>
            {siteTitle}
          </a>
          {user ? (
            <div class="user-tools">
              <span class="user-name">{user.name}</span>
              {showLogout ? (
                <form method="post" action={`${prefix}/logout/`}>
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <button type="submit">{messages.logout}</button>
                </form>
              ) : null}
            </div>
          ) : null}
        </header>
        <nav class="breadcrumbs">
          {breadcrumbs.map((item, i) => (
            <>
              {i > 0 ? " › " : null}
              {item.href === undefined ? (
                <span>{item.label}</span>
              ) : (
                <a href={item.href}>{item.label}</a>
              )}
            </>
          ))}
        </nav>
        {flash.length > 0 ? (
          <ul class="messagelist">
            {flash.map((m) => (
              <li class={m.level}>{m.text}</li>
            ))}
          </ul>
        ) : null}
        <main id="content">{props.children}</main>
      </body>
    </html>
  );
}
