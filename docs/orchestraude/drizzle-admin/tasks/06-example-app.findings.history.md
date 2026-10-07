## Round 1

# Review findings

high: 0, medium: 1, low: 2

## high


## medium

- [spec] Seed has no post published today; the publishedAt 'today' filter is always empty
  - location: example/seed.ts:61
  - detail: interfaces/example.md requires posts with dates 'within today / past 7 days / this month, so that pagination and filters show', and the task notes repeat 'incl. today'. Posts are published when i % 3 !== 0 and take their age from PUBLISH_AGES_DAYS[i % 6]. Ages 0 and 12 sit at i % 6 == 0 and 3, and both of those indices are drafts (publishedAt null). So the published posts only have ages 2, 5, 40 and 75 days (10 each), and filtering posts by publishedAt 'today' always returns nothing. In the first days of a month, 'this month' can also be empty (ages 2 and 5 then fall in the previous month). Fix: make the age index independent of the draft pattern, e.g. use the published-post counter, or use a list length that is coprime with 3, so ages 0 and 12 land on published posts.
  - evidence: (none)

## low

- [security] Demo server listens on all interfaces with default admin/admin credentials
  - location: example/server.ts:20
  - detail: serve({ fetch, port }) passes no hostname, and @hono/node-server calls server.listen(port, undefined), which binds to all interfaces. If ADMIN_PASSWORD is unset, anyone on the local network can log in as admin/admin and change the in-memory demo data. The impact is limited because the data is in-memory demo data and a warning is printed. To fix it, consider passing hostname: process.env.HOST ?? "127.0.0.1" (or binding to loopback when the default password is in use) so the demo is local-only unless the user opts in.
  - evidence: (none)
- [spec] Extra startup notice for unset ADMIN_SECRET not in the design
  - location: example/server.ts:15
  - detail: The design only calls for a startup warning when the default password is in use, plus the URL and login hint. server.ts also prints a note when ADMIN_SECRET is unset. The note is harmless and matches the design's statement that sessions do not survive a restart; keep it or drop it as preferred.
  - evidence: (none)


### Implementer response after round 1

Added example/schema.ts, seed.ts (constant DDL, deterministic seed: 5 users, 60 posts, 8 tags, dates relative to now), app.ts (createExampleApp with users/posts/tags registrations, deactivate(confirm)/activate actions, GET / redirect, admin.app mounted at /admin so registry finalization runs), server.ts and test/example.test.ts. Manual check run: pnpm example + GET / returned 302 with location /admin/ (recorded in task History). Fix round: the medium finding (no post published today) is fixed in seed.ts by indexing publish ages with a counter of published posts instead of the post index, so ages 0 (today), 2, 5 (past 7 days), the this-month age and older ones all land on published posts; the this-month age is clamped to min(12, dayOfMonth-1) so it stays in the current month early in a month. Low findings left unchanged: (1) binding to all interfaces with default admin/admin: the design specifies serve on PORT only and the data is in-memory demo data with a startup warning; adding a HOST option would extend the specified behavior. (2) extra ADMIN_SECRET notice: harmless and consistent with the design statement that sessions do not survive restart.

