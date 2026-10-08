---
id: 2026-10-08-confirm-action-listhref-prop
question: Which props does the task 21 ConfirmActionPage take, and how does the actions route fill them?
source: src/views/confirm-action.tsx, src/routes/actions.ts (working tree 2026-10-08, task 21, uncommitted)
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- `ConfirmActionPageProps` = `modelLabel: string`, `action: string`, `actionLabel: string`, `isDelete: boolean`, `items: { pk: string; label: string }[]`, a required `listHref: string`, and `backQuery: string` (leading "?" or "").
- `form#action-confirm` posts to `${listHref}${backQuery}`; the cancel link uses the same URL. `PageChrome` carries `prefix` but no model slug, so the view cannot build the list URL itself.
- `actionsHandler` computes `listUrl = ${state.config.prefix}/${model.slug}/` and `backQuery = new URL(c.req.url).search`, and passes `listHref: listUrl, backQuery` on both confirmation renders (delete_selected and custom actions with `confirm: true`).

Not confirmed:
- The code is uncommitted task 21 work; whether its tests pass was not run here.
