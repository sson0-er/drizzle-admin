import type { Child } from "hono/jsx";
import type { FlashMessage } from "../auth/flash.js";
import { LOCALE_NAMES, LOCALES, type Locale, type Messages } from "../messages.js";
import { ADMIN_CSS_VERSION } from "../static/admin-css.js";
import type { AdminUser } from "../types.js";
import { FLASH_ICONS, Icon } from "./icons.js";

export interface PageChrome {
  locale: Locale;
  t: Messages;
  siteTitle: string;
  prefix: string;
  title: string;
  user: AdminUser | null;
  /** True in builtin auth mode when a user is logged in. */
  showLogout: boolean;
  csrfToken: string;
  /** Raw path + query of this page, the switcher's `next`; null renders no switcher. */
  currentUrl: string | null;
  flash: FlashMessage[];
  /** The first item is always Home -> `${prefix}/`. */
  breadcrumbs: { label: string; href?: string }[];
}

export function Layout(props: PageChrome & { children?: Child }) {
  const {
    locale,
    t,
    siteTitle,
    prefix,
    title,
    user,
    showLogout,
    csrfToken,
    currentUrl,
    flash,
    breadcrumbs,
  } = props;
  return (
    <html lang={locale}>
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
          <div class="header-tools">
            {currentUrl === null ? null : (
              <form
                class="lang-switch"
                method="post"
                action={`${prefix}/_lang/`}
                aria-label={t.language}
              >
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="next" value={currentUrl} />
                {LOCALES.map((l, i) => (
                  <>
                    {i > 0 ? " / " : null}
                    <button
                      type="submit"
                      name="lang"
                      value={l}
                      lang={l}
                      aria-current={l === locale ? "true" : undefined}
                    >
                      {LOCALE_NAMES[l]}
                    </button>
                  </>
                ))}
              </form>
            )}
            {user ? (
              <div class="user-tools">
                <span class="user-name">{user.name}</span>
                {showLogout ? (
                  <form method="post" action={`${prefix}/logout/`}>
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <button type="submit">
                      <Icon name="logout" />
                      {t.logout}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
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
              <li class={m.level}>
                <Icon name={FLASH_ICONS[m.level]} />
                {m.text}
              </li>
            ))}
          </ul>
        ) : null}
        <main id="content">{props.children}</main>
      </body>
    </html>
  );
}
