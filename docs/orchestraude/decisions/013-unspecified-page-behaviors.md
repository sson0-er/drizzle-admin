# 013: Page behaviors the pre-spec leaves unspecified

- Date: 2026-10-07
- Status: accepted

## Context
The pre-spec defines pages and options but leaves several low-impact behaviors open. These choices follow Django Admin ("feel like Django Admin", §1) unless noted. Higher-impact gaps were raised to the user as Q1-Q4 instead (answered in decisions 014-017).

## Decision
1. Change page with `view` but without `change` permission: GET renders all fields read-only and without save buttons; POST returns 403 (Django 2.1+ behavior).
2. Non-auto-increment primary keys are editable on the add page and display-only on the change page (no primary-key rename).
3. Default `listDisplay`: the primary key followed by the first 4 non-key fields in definition order.
4. Default ordering when neither `o` nor `options.ordering` applies: primary key descending. Otherwise the primary key is appended ascending when absent (§7).
5. Header click cycles one column at a time: not sorted → `o=k` → `o=-k` → no `o`. Other sort keys are dropped. A manually written multi-key `o` is still honored.
6. Query parameters: `q` search, `p` page (1-based), `o` ordering, `f_<key>` filters. Changing search, filter or ordering drops `p`. A non-integer or `< 1` page becomes 1; a page beyond the last renders an empty table with pagination.
7. FK filter choices show the first 200 referenced rows in the referenced model's default ordering.
8. In external-auth mode (`getUser`) `/login/` and `/logout/` return 404 and no logout button is shown. When both `verifyCredentials` and `getUser` are set, `getUser` wins (§5.2 "When set, the login page is not used"). Unauthenticated in external mode without `loginUrl` → 401 page.
9. Failed login re-renders with status 400 (consistent with §9 error status).
10. `beforeSave` / `beforeDelete` throwing → generic error (400 form error, or error flash on delete). `afterSave` throwing after a successful write → success redirect with an extra warning flash. Action `run` throwing → generic error flash. Hook and action error messages are not rendered.
11. The `password` widget renders `<input type="password">` with the current value like any text input (no special semantics).
    Changed 2026-10-08: superseded by decision 037. The `password` input always renders empty (no stored or submitted value in the HTML), and an empty submission on the change page keeps the stored value.
12. Trailing-slash redirect uses 301 (Django `APPEND_SLASH`).
13. Changed 2026-10-07: `listFilter` also accepts kind string + `isDateOnly` (PG `date()` string mode, decision 023), and widget overrides are checked by `allowedWidgets` (decision 021). `register()` additionally rejects: `listFilter` on fields other than kind boolean/enum/date, `isDateOnly` (kind string, decision 023) or FK; `searchFields` on kinds other than string/enum; both `fields` and `fieldsets` given; duplicate action names or the reserved name `delete_selected`; `listPerPage` not a positive integer.

## Alternatives considered
- (1) 403 on GET without change permission: makes view-only users unable to see details.
- (2) Editable PK on change: an UPDATE of the key cascades unpredictably and the URL changes.
- (4) Ascending PK default: shows oldest first, unlike Django's `-pk` fallback.
- (10) Rendering hook error messages: may leak internals; hooks can call `validate` for user-facing errors instead.

## Rationale
Django behaviors are matched where §1 asks for a Django feel (unverified against current Django docs; the behaviors are well known). Rule 13 turns configurations that would otherwise fail at query time (for example PG `ilike` on an integer column, unverified) into registration errors as §5.2 intends.

## Consequences
- These behaviors are documented in the README.
