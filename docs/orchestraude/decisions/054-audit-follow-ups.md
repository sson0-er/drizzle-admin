# 054: Audit follow-ups: unreadable POST body, decimal-only numbers, `refSlugOf`, unused CSS, FK choices on POST

- Date: 2026-11-11
- Status: accepted

## Context
A whole-project audit (2026-11-11) found five points where the code and the design had to change or an existing behavior had to be recorded. The user approved the recommended option for each (2026-11-11).
1. A POST whose body cannot be parsed (for example `multipart/form-data` without a valid boundary) made `c.req.parseBody` reject inside the `csrfToken` middleware. The error reached `onError`: a 500 page and a `console.error` line. `/login/` and `/_lang/` accept a POST without a login, so an anonymous client could trigger it at will.
2. Coercion of a non-integer number field used `Number(s)` alone (forms.md rule 3), so `0x1F`, `0b11` and `0o17` were stored as 31, 3 and 15. Integer fields already reject them (decision 045).
3. `buildFormGroups` took `refSlugOf(key)` and built the FK fallback link from `refSlugOf(key) ?? fk.slug`. The only caller looked up `foreignKey.slug` of the same field, so both values were always equal.
4. The stylesheet kept `tr.selected`, `.button` and `button.deletelink`; no view renders an element they match.
5. The add and change handlers load the FK choices before they know whether a POST will succeed, so a successful save runs one `options` query per FK field whose result is not used.

## Decision
1. `csrfToken` treats a body that `parseBody` cannot read like a missing token: 403 error page with `t.csrfFailed`, nothing logged. `body` is set in the context only after the token check passes.
2. A non-integer number field accepts decimal notation only: optional sign, digits with an optional fraction (or a fraction alone), optional exponent (`/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i`), checked after the finite check. Anything else is `invalidNumber`. Integer fields are unchanged (decision 045), so `0x1F` there is still `invalidInteger`.
3. `refSlugOf` is removed from `buildFormGroups`; `fkFallbackHref` is `<prefix>/<foreignKey.slug>/`.
4. The three rules are removed from `ADMIN_CSS` and from views-style.md. The `--selected-bg` token stays (selected filter choice).
5. No change: the FK choices are still loaded before the save. Recorded as accepted in `review-policy.md`.

## Alternatives considered
- Point 1, answer 400: needs a new message key in both dictionaries and a new status for the same client-visible meaning ("this request could not be verified").
- Point 1, keep the 500 and only stop logging: the status would still report a server fault for a client error.
- Point 2, reject only the `0x` / `0o` / `0b` prefixes: an allow-list states the accepted grammar once, and it equals what `Number()` accepts minus the radix prefixes and `Infinity`.
- Point 2, apply the pattern to integer fields too: it would change their error from `invalidInteger` to `invalidNumber` for no gain (decision 045 already rejects the input).
- Point 3, keep the parameter for a future caller with another slug source: no such caller exists, and the redundant lookup had already been raised twice in review (L011, L128).
- Point 5, load the choices lazily (only for a GET or a failed POST): the widget of an FK field depends on the choices, so the handler would need a second code path to build the groups; an admin save is rare enough that one bounded query (201 rows at most) per FK field does not justify it.

## Rationale
- Point 1: hono's `parseBody` rejects with a `TypeError` for an unparsable form body and resolves to `{}` for other content types (evidence: 2026-11-11-hono-parsebody-malformed-body). The token check is the first thing that needs the body, and a request without a readable token already answers 403 (routes.md, middleware 7).
- Point 2: `Number("0x1F") === 31`, `Number("0b11") === 3`, `Number("0o17") === 15` (ECMAScript StringNumericLiteral). HTML number inputs submit decimal notation only, so the stricter rule only affects hand-made requests and `text` overrides.
- Points 3 and 4: dead code; removing it changes no rendered page (the stylesheet hash, and so the `?v=` cache key, changes).

## Consequences
- routes.md (middleware 7), forms.md (`buildFormGroups` signature, the tooMany row, coercion rule 3), views-style.md (variant table, button and delete-link rules, results table), test-strategy.md (cases below).
- Tests: `auth.test.ts` (unreadable multipart body → 403 `csrfFailed`, nothing logged; logged in, and anonymous on `/login/` and `/_lang/`); `coerce.test.ts` (radix literals rejected, signed / fraction-only / exponent forms accepted on a non-integer field); `fields.test.ts` (the `refSlugOf` case is removed); `admin-css.test.ts` (button rule string).
- CHANGELOG: points 1 and 2 are user-visible changes.
