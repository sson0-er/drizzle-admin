# Changelog

## 0.1.1 - 2026-11-11

### Changed

- A POST whose body cannot be parsed (for example broken `multipart/form-data`) now gets the 403 "Invalid request (CSRF)" page. Before, it caused a 500 and an error log line, also for requests without a login on the login and language-switch routes.
- Number fields that are not integers accept decimal notation only. `0x1F`, `0b11` and `0o17` are now rejected with "Enter a number." instead of being saved as 31, 3 and 15.
- `zod` is required at `^4.6.6` (was `^4.6.5`) because of the advisory GHSA-mrhx-c7xc-m3w5.
- The stylesheet no longer contains the unused rules `tr.selected`, `.button` and `button.deletelink`.

### Added

- README: the OpenID Connect example (`pnpm example:oidc` in the repository; the example is not part of the package).

## 0.1.0 - 2026-10-09

Initial release.

### Added

- `createAdmin`, `admin.register`, `admin.app` and `admin.fetch`: a server-rendered, Django Admin-style CRUD admin for Drizzle ORM tables, mounted in a Hono app. `drizzle-orm` (`^0.45.3`) and `hono` (`^4.13.13`) are peer dependencies; Node.js 22 or later.
- SQLite and PostgreSQL.
- List pages with search, filters, sortable columns and pagination; bulk delete and custom actions with an optional confirmation page.
- Add and change forms generated from the table definition, with widget overrides, zod validation, a `validate` callback, hooks and read-only fields.
- Built-in login with a signed session cookie, or external authentication through `getUser` and `loginUrl`; per-model `view` / `add` / `change` / `delete` permissions.
- Security: HMAC-signed cookies with keys derived per admin instance, CSRF protection (Origin check and token), Content-Security-Policy and other security headers, and bounded input (search text, selections and `listPerPage`).
- English and Japanese UI, English by default, with a language switcher remembered in the `da_lang` cookie.
- Light and dark color schemes and a responsive layout; everything works without JavaScript except "select all".
