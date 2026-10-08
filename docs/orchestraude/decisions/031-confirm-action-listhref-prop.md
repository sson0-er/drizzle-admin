# 031: `ConfirmActionPage` takes a required `listHref`

- Date: 2026-10-08
- Status: accepted

## Context
Task 21 implemented `ConfirmActionPage` (src/views/confirm-action.tsx) with a required `listHref: string` prop that interfaces/views.md did not list. The confirmation form must post to the list URL plus `backQuery`, and `PageChrome` carries `prefix` but no model slug, so the view cannot build that URL from its other props (evidence: 2026-10-08-confirm-action-listhref-prop).

## Decision
- views.md: `ConfirmActionPage` props include `listHref: string` (required): the list URL `${prefix}/${slug}/`. `form#action-confirm` posts to `listHref + backQuery`, and the cancel link points to the same URL.
- routes-handlers.md (Actions): both confirmation renders (delete_selected without `_confirm`, custom action with `confirm` without `_confirm`) pass `listHref` = list URL and `backQuery` = the request's query string, alongside `modelLabel`, `action`, `actionLabel`, `isDelete` and `items`.

## Alternatives considered
- Pass `model: { slug; label }` as `ListPage` does and build the URL in the view: equivalent, but diverges from the task 21 code and duplicates URL construction that the handler already does for `back`.
- Add the model slug to `PageChrome`: widens a type shared by every page for one page's need.
- Pass one combined `actionHref` (list URL + query): loses the separate `backQuery` the design already names and diverges from the code.

## Rationale
This follows the user's policy for internal API gaps found during implementation: update the design to match the implementation (see decisions 027, 028 and 030). The handler already computes the list URL for its redirects, so passing it is the smallest change that matches the code (evidence: 2026-10-08-confirm-action-listhref-prop).

## Consequences
- views.md "Pages" table row for `ConfirmActionPage`; routes-handlers.md Actions step 2 and 3 confirmation renders.
- No code change: task 21 already implements this.
