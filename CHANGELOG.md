# Changelog

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
