# Adversarial verification of the two medium findings (HEAD ad0ebeb)

Reproduction: `$SCRATCHPAD/verify/verify.test.ts` (vitest, SQLite fixture, imports `src/` and `test/helpers/` read-only; no repository file was changed). Run from the repo root with `npx vitest run --config <scratchpad>/verify/vitest.config.ts --root <scratchpad>/verify --silent=false`.

## Finding A: rows of a model whose `view` is denied are readable through write routes

**Verdict: DOWNGRADE to low.**

### Reproduced
Config `authors: { permissions: { view: (u) => u.name === "root" }, toString: name + email, readonlyFields: ["email"] }`, logged in as `tester`:

| Request | Result |
|---|---|
| GET `/admin/authors/`, GET `/admin/authors/2/change/` | 403 (view gate works) |
| POST `/admin/authors/` `action=delete_selected`, `_selected=1..4`, no `_confirm` | 200, all four labels (`alice <alice@example.com>` ...) |
| GET `/admin/authors/3/delete/` | 200 with the label |
| POST `/admin/authors/2/change/` `name=` | 400 with the label and the read-only `bob@example.com` |
| POST `delete_selected` with `_confirm=1` | 303, row deleted |

The code path is real.

### Why it is not medium
- **This is documented, intended behavior.** README "Options" says `permissions` defaults to "all allowed" and "An unset entry allows the operation". README "Permissions" lists the four permissions as independent gates: `view` covers the dashboard, the list and the change GET; `change` covers saving; `delete` covers the delete page and `delete_selected`. Nothing in the README, routes-handlers.md (Change step 1: "GET needs `view`, POST needs `change`") or decisions 013/016 says that `change` or `delete` requires `view`. The handlers match the design exactly. The authz audit's own route x permission matrix says "Every cell matches routes-handlers.md".
- **The read leak is dominated by what the config already grants.** With `view` restricted and the other permissions unset, the same user may, by documented default, delete every row (last table row above) and overwrite any editable field by pk. A confidentiality leak of labels to a user who already has blind delete/overwrite rights on the same rows is a secondary effect of an operator choice, not a separate authorization bypass. The real hazard is the default-allow footgun, and that is a documented design choice that would need a decision to change.
- **Django is largely the same.** In Django `has_change_permission` implies view: a change-only user sees the full change form. `delete_view` checks only `has_delete_permission` and renders the object's `str()` plus related objects. The one difference is that Django's changelist (where bulk actions run) needs view-or-change, so a delete-only Django user cannot reach `delete_selected`. Here they can, and the confirm page lists labels. That is a small divergence, not a contradiction of the design.
- The CLAUDE.md rule "Values the user may not see are not rendered" is scoped by its own parenthetical to FK labels (decision 034) and password values (decision 037). It does not define the meaning of `view` against `change` and `delete`.

### Suggested low-level follow-up (optional, needs a decision record)
Add a README note under "Permissions": `change` and `delete` let the user see row labels and read-only values on their pages, as in Django. Restrict them together with `view` if the rows must stay hidden. Alternatively, a decision could make unset `add`/`change`/`delete` inherit the resolved `view` value so that restricting `view` alone fails closed.

## Finding B: a session from one `createAdmin` instance is accepted by another instance with the same `secret`

**Verdict: CONFIRMED (medium stands, conditional on a shared secret).**

### Reproduced
Two builtin-mode instances on one DB with the same `secret`: `/staff` (`verifyCredentials` accepts only `clerk`) and `/ops` (accepts only `root`).

| Step | Result |
|---|---|
| POST `/ops/login/` as `clerk` | 400 (ops rejects clerk) |
| Log in at `/staff`, send the same `da_session` value to GET `/ops/` | 200, page shows `clerk`, no redirect to login |
| GET `/ops/authors/` with it | 200 (default permissions give full CRUD) |
| Same, with both instances returning user id `"1"` from different user tables | 200, and ops sees id `"1"`, so id-based permission checks also pass |
| Replay to an external-mode instance (`getUser` returns null) | 302 to `loginUrl`: not affected |

### Attempts to disprove, and why they fail
- **Cookie Path.** The cookie is `Path=/staff` (`cookieAttrs`), so the browser does not send it to `/ops` by itself. But the attacker is the cookie's owner and copies it by hand (devtools, curl). Path is not a security boundary. With nested base paths (`/admin` and `/admin/super`) the browser sends the parent cookie automatically.
- **"Nothing gained over own credentials."** False in builtin mode. `verifyCredentials` returns any `AdminUser {id, name}` and can serve many users, so each instance can have its own user population. The session stores only `{id, name}`, and `userMiddleware` trusts `session.u` without asking the instance again (src/routes/middleware.ts:50-53). Replaying the cookie skips the target instance's only authentication gate: the clerk could not log in to `/ops` (400) but is accepted with the cookie. Permission callbacks see only `{id, name}`, and ids from different user stores can collide.
- **External mode.** It ignores `session.u`; the user comes from `getUser(req)`. A crossed cookie gives only a CSRF token for the attacker's own session, so this mode is not affected.
- **Documented?** No. README describes `secret` only as "At least 32 characters. Signs the session and flash cookies". Nothing in the README, the design (admin.md, auth.md, routes.md step 4) or decision 008 covers multiple instances or requires a unique secret. review-policy.md has no matching entry. Known limitations mention only non-revocation of a copied cookie on the same instance.
- **Realistic?** It needs two builtin-mode instances in one host with different user sets and one reused secret (e.g. one `ADMIN_SECRET` env var). Mounting several admins is a supported use (per-instance `basePath`, path-scoped cookies), and reusing one secret is an easy mistake the docs do not warn about. The result is privilege escalation into the more privileged panel. This is the main reason the verdict is not "low", although the precondition is a deployment choice.

### Recommended fix
Bind the signature to the instance and purpose so the library fails closed even when the secret is reused. Derive the signing keys, e.g. `HMAC(secret, "da_session\0" + prefix)` and `HMAC(secret, "da_flash\0" + prefix)`, and pass them to `setSignedCookie`/`getSignedCookie`. As an alternative, put the prefix in the session payload and reject a mismatch in `parseSession`. Key derivation also separates session and flash values (today only their JSON shapes keep them apart). Also state in the README `secret` row that each instance should have its own secret. Changing the keys signs everyone out once; mention this in the changelog. Add a test: a session cookie from instance `/a` is treated as anonymous by instance `/b` with the same secret.
