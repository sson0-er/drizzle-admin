# Review findings

high: 0, medium: 0, low: 5

## high


## medium


## low

- [quality] Redundant alias and long listHandler
  - location: src/routes/list.ts:101
  - detail: `const model = found;` only renames the narrowed value; rename the variable or narrow in place. listHandler also builds table rows, columns, filters and actions inline; extracting row/filter builders would make each part do one thing.
  - evidence: (none)
- [security] FK labels and FK filter choices ignore the referenced model's view permission
  - location: src/routes/list.ts:59
  - detail: loadFkLabels (getMany) and filterChoices (repo.options, up to 200 rows) read the referenced model's toString labels and primary keys whenever the user can view the listed model. They never check can(ref, "view", user). A user who may view articles but not authors still sees author labels in cells and the first 200 author labels/ids in the filter sidebar. The routes-handlers design prescribes this, and Django admin behaves the same way, so it is not a defect of this task. If the referenced model's labels should stay private, skip the labels/links and the FK filter when !can(ref, "view", user). Otherwise record this as an accepted convention in review-policy.md.
  - evidence: (none)
- [spec] design ambiguity: FK filter value outside the 200 offered choices filters rows but marks 'all' selected
  - location: src/routes/list.ts:185
  - detail: The comment says the repository treats an unknown value as 'all'. That holds for boolean, enum and date presets. It does not hold for FKs: buildFilters (src/data/query.ts:78-80) filters by any parseable pk. Example: a model has more than 200 referenced rows (decision 013 item 7 caps the choices at 200), or a bookmarked URL uses f_authorId=<pk not in the first 200>. The table is filtered, but the sidebar marks 'all' as selected, and no choice shows the active filter. The design does not say what to show in this case. Options: (a) accept it and fix the comment; (b) add the active referenced row as an extra choice, or mark no choice as selected. Ask the user which one.
  - evidence: (none)
- [spec] design ambiguity: header data-sort reflects only the user's `o`, not the default ordering
  - location: src/routes/list.ts:174
  - detail: When there is no `o`, every column shows data-sort="none", even when the rows are ordered by M.ordering (for example `-name`) or by the `-pk` fallback. views.md and decision 013 item 5 define the cycle that starts from 'not sorted' but do not say whether the default ordering counts as sorted. Django shows indicators for the default ordering. The implementer chose this so the asc -> desc -> off cycle never produces a dead link. Confirm with the user.
  - evidence: (none)
- [spec] design ambiguity: FK column that is also in listDisplayLinks links to the row's change page
  - location: src/routes/list.ts:158
  - detail: views.md says a Cell href is 'for listDisplayLinks (change page) or FK links' but does not say which wins when a key is both. The code gives listDisplayLinks precedence, which is consistent with Django, where list_display_links always means the row's change page. Confirm this precedence, and record it in the design if it is accepted.
  - evidence: (none)

