# Review findings

high: 0, medium: 0, low: 3

## high


## medium


## low

- [quality] inherit repeats the permission option type
  - location: src/admin.ts:245
  - detail: The inherit helper spells out `boolean | ((user: AdminUser) => boolean) | undefined`, the same union as toPermission's parameter. Use `Parameters<typeof toPermission>[0]` or a shared alias so the two cannot drift. Preference only.
  - evidence: (none)
- [tests] Dashboard hidden-link test has no positive control
  - location: test/auth.test.ts:753
  - detail: The test asserts no href starts with /admin/authors/ for view:false, but does not show that the same dashboard with clientWith({}) does list such a link, so a changed link shape would make it pass vacuously. Add a control request in the same test.
  - evidence: (none)
- [tests] Permission inheritance table only checks user 1 and uses an unsafe cast
  - location: test/register.test.ts:520
  - detail: The static rows call permissions with `users[0] as never`; the cast is unnecessary since users[0] is a valid user, and the second user is only used in the view-function rows. Drop the cast (or use a const user). The view-function rows also compute expected via byId, mirroring the predicate; literal expectations per user would be sturdier.
  - evidence: (none)

