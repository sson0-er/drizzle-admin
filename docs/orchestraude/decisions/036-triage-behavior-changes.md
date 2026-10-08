# 036: Behavior changes from the low-findings triage (FK fallback link, deletion cookies, vanished rows)

- Date: 2026-10-08
- Status: accepted

## Context
The low-findings triage (section B) raised four design gaps where the user chose to change the implemented behavior: L062 (FK "too many choices" link on non-select overrides), L072 (cookie deletion without `Secure`), L003 (custom-action confirmation listing zero rows) and L074 (success flash when a single delete removes 0 rows).

## Decision
User decision (2026-10-08).
1. L062 (forms.md): when the FK choices are `"tooMany"`, the `fkFallbackHref` link (and the `fkTooMany` hint) is set only when the widget is the default or a `select` override; those fields fall back to the plain `number` / `text` input. `hidden`, `number` and `text` overrides keep their widget and get no link.
2. L072 (auth.md): deleting a cookie uses the same attributes as setting it: `clearSession` and `consumeFlash` call `deleteCookie` with `httpOnly: true`, `sameSite: "Lax"`, `path: prefix || "/"` and `secure: isSecure(c, publicOrigin)` (https `publicOrigin`, or an https request URL when `publicOrigin` is absent). Hono's `deleteCookie` passes these through to the `Max-Age=0` Set-Cookie (evidence: 2026-10-08-hono-head-cookie-body-node-server).
3. L003 (routes-handlers.md Actions): a custom action with `confirm: true`, posted without `_confirm`, loads `rows = repo.getMany(...)`; when `rows` is empty it flashes the `noSelection` warning and redirects 303 back, like `delete_selected` (decision 033 item 3). The `_confirm=1` step is unchanged (`run` receives the submitted ids).
4. L074 (routes-handlers.md Delete, support.md): when `repo.delete(M.meta, [pk])` returns 0 (the row vanished between `get` and `delete`), the handler flashes a warning with the new message `alreadyDeleted(label)` instead of `deleted(label)` and redirects 303 to the list URL. `beforeDelete` has already run at that point; that is unchanged.

## Alternatives considered
- L062: keep the link for every override (current): a `hidden` input with a visible "open related list" link is meaningless, and the `fkTooMany` hint talks about a choice list the field never had.
- L072 (a): read the DoD as "the cookie when it is set" and keep deletions without `Secure`: rejected by the user; the proxy test could not check a GET.
- L003: render an empty confirmation list (current): the user confirms an action on nothing.
- L074: keep the success flash (current): claims a deletion that did not happen in this request. Return 404: the user did ask to delete it and it is gone; a redirect with a warning is friendlier.

## Rationale
User decision after the low-findings triage. Hono's `deleteCookie` forwards every option, so the change is local to `session.ts` and `flash.ts` (evidence: 2026-10-08-hono-head-cookie-body-node-server). Whether a browser would refuse a non-`Secure` deletion of a `Secure` cookie is unverified; matching the attributes avoids depending on it.

## Consequences
- New messages key `alreadyDeleted: (s: string) => string` (support.md).
- test-strategy.md: proxy GET checks the `Secure` deletion of `da_flash`, logout checks the `Secure` deletion of `da_session`; delete with a concurrently removed row; custom confirm action with only nonexistent ids; `tooMany` with a `hidden` override has no link.
- Follow-up code changes in `src/forms/fields.ts`, `src/auth/session.ts`, `src/auth/flash.ts`, `src/routes/actions.ts`, `src/routes/delete.ts`, `src/messages.ts`.
