# 043: Unset write permissions inherit `view`; a model with no granted permission answers 404 like an unknown slug

- Date: 2026-10-08
- Status: accepted

## Context
Security audit finding A (downgraded to low in security-audit/verify.md): `permissions` entries default to allowed when unset, so `permissions: { view: (u) => u.isAdmin }` hides a model from the list and dashboard but leaves add, change, delete and bulk delete open, and those pages show row labels and read-only values. A second low finding: every model route resolves the slug before the permission check, so a registered model the user may not see answers 403 while an unknown slug answers 404, which reveals the names of hidden models.
The user approved (2026-10-08): unset `add` / `change` / `delete` take the `view` result, explicitly set entries are unchanged, and a registered model the user cannot view answers 404 instead of a 403 that reveals its name. The user asked the designer to decide exactly which routes and permissions the 404 covers.

## Decision
1. Inheritance. In `ResolvedModel.permissions`, `view` resolves as before (unset → always true). `add`, `change` and `delete` each resolve to the resolved `view` function when their entry is unset (`undefined`); a boolean or function entry is used as given. So restricting `view` alone closes the model, and leaving every entry unset still allows everything.
2. Hidden model. A registered model is hidden from a user when `can(M, p, U)` is false for all four permissions `view`, `add`, `change` and `delete`. `modelOr404` treats a hidden model exactly like an unknown slug: the same 404 page, before any other check of the handler. This applies to every model route: list (GET `/:model/`), actions (POST `/:model/`, whatever the body, including no selection and unknown action names), add, change (GET and POST) and delete (GET and POST).
3. Everything else is unchanged. A model that grants the user at least one permission keeps the per-route 403 for a missing permission, for example a viewable model without `change` (change POST → 403) or a model with `view: false, add: true` (list → 403, add page → 200). The dashboard still lists models with `view`.
4. README: the `permissions` row says unset `add` / `change` / `delete` follow `view`; the "Permissions" section says that a model without any permission for the user answers 404 like an unknown page, and that explicitly granting `change` or `delete` without `view` lets the user see row labels and read-only values on those pages (as in Django).

## Alternatives considered
- 404 whenever the route's permission is missing and the user also lacks `view` (per-route rule): for the actions route the selection and action-name checks run before the permission check, so the 303 for "no selection" or "unknown action" would still reveal the model unless the handler is reordered; and a user with an explicit `add: true` can open the add page, which shows the model label anyway, so answering 404 on the list hides nothing from them.
- 404 whenever the user lacks `view`, on every route: breaks explicit configurations such as `view: false, add: true` that the user asked to keep unchanged.
- Require `view` for the delete page, bulk confirmations and the change POST re-render (the audit's option (b)): more rules per handler, and it changes explicitly set entries; inheritance (option (a)) is the one the user chose.

## Rationale
With inheritance, "cannot view" in the default configuration means "no permission at all", so the hidden-model rule gives 404 exactly in the case the user described, with one check in one place (`modelOr404`) for all routes. A user who holds any permission on the model can reach a page that shows its label, so a 403 tells them nothing new. Django also lets a user with only change or delete permission see an object's string on those pages (security-audit/verify.md, finding A; unverified beyond that note).

## Consequences
- admin.md (`ResolvedModel.permissions`), routes.md (`modelOr404`), routes-handlers.md (step 1 of each handler), project-setup.md (README rows), test-strategy.md.
- Behavior change for existing configurations that restrict only `view`: users without `view` lose add, change and delete on that model. Recorded in `CHANGELOG.md` (decision 048).
