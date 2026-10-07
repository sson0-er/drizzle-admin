# 006: Relative routes, catch-all root/trailing-slash handler, lazy app build

- Date: 2026-10-07
- Status: accepted

## Context
§5.1 mounts with `app.route("/admin", admin.app)` and also wants `admin.fetch`. §8 wants Django-style trailing slashes with redirects, and the dashboard at `<basePath>/`. Links and redirects need the absolute base path. FK slugs depend on which models are registered, and registration order is arbitrary.

## Decision
Changed 2026-10-08: the missing-slash redirect happens only when the path after the prefix is empty or an allowlisted `/segment/...` shape (no empty segment, no `\`, no control character); anything else is 404, so it never redirects off-site with basePath "/" (decision 029, amended after a tab-character bypass of its first denylist version).

- `admin.app` is a Hono app whose routes are relative (`/login/`, `/:model/`, ...). It must be mounted at `config.basePath`. `admin.fetch(req)` wraps it in an internal `new Hono().route(basePath, app)`, so it accepts full URLs.
- The dashboard, the missing-slash redirect and 404s are handled by a GET `/*` catch-all registered last. It inspects `c.req.path`: `<prefix>/` → dashboard; a path not ending in `/` → 301 to path + `/` + query (except as amended by decision 029); anything else → 404.
- `admin.app` is built lazily on first access of `admin.app` or `admin.fetch`. This finalizes the registry: FK slugs are resolved and cross-model options are validated. `register()` after finalization throws.
- Slugs `login`, `logout` and `static` are reserved and rejected by `register()`.
- Route handlers live in `src/routes/*` (a layout addition to §4); `src/admin.ts` keeps createAdmin/register/finalize.

## Alternatives considered
- `new Hono({ strict: false })`: `/x` and `/x/` would both match, so there would be no redirect to the slashed URL.
- `hono/trailing-slash` middleware: relies on a 404 from routing first; the mounted root `/admin/` never matches a `"/"` route anyway.
- Eager FK resolution on every `register()` (updating earlier metas): works, but cross-model validation (FK listFilter target must be registered) cannot run until all models are known.

## Rationale
A mounted sub-app route `"/"` matches `/admin` but not `/admin/`. Only `"/*"` matches both, and `c.req.path` distinguishes them. The first registered matching handler wins, so the catch-all must be last and fixed segments such as `/login/` must not be shadowed by `/:model/` (evidence: 2026-10-07-hono-routing-cookies-script-escaping).

## Consequences
- The user must mount `admin.app` at exactly `basePath` (README states it).
- Calling `register()` after `admin.app` is accessed is an error with a descriptive message.
