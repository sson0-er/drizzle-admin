# Review findings

high: 0, medium: 0, low: 6

## high


## medium


## low

- [quality] Prev link guard and clamp are redundant-looking
  - location: src/views/list.tsx:48
  - detail: `page > 1 && pages >= 1` with `Math.min(page - 1, pages)` handles out-of-range pages implicitly; add a short comment saying why (page beyond last), or simplify, so the intent is clear.
  - evidence: (none)
- [quality] Paginator receives props re-passed field by field
  - location: src/views/list.tsx:136
  - detail: ListPage destructures most props but passes page/pages/total/pageHref individually to Paginator; spreading or destructuring them once would be slightly more uniform.
  - evidence: (none)
- [spec] design ambiguity: list column headers and filter headings show raw field keys
  - location: src/views/list.tsx:127
  - detail: The ListPage props in views.md give `columns` as { key; sort; sortHref } and `filters` as { key; choices }, with no label field. So the header link text (line 127) and the filter heading `<h3>{f.key}</h3>` (line 166) show the raw property key, for example `authorId`, instead of a human label. The implementation follows the design as written. Ask the user whether `columns` and `filters` should carry a `label` (filled in by the route from the field metadata) so the headers can show labels.
  - evidence: (none)
- [spec] design ambiguity: paginator prev/next and breadcrumb separator are literals outside messages
  - location: src/views/list.tsx:49
  - detail: support.md says no source file other than messages.ts contains UI text literals. The paginator renders the literal symbols ‹ / › (list.tsx:49, 61) and the breadcrumb separator ' › ' (layout.tsx:52), because messages has no keys for them. These are glyphs, not words, so this may be acceptable. Ask the user whether to add keys (e.g. `previous`, `next`) or to accept the symbols as non-text.
  - evidence: (none)
- [tests] Pagination edge test is dense and uses sort() on mixed strings
  - location: test/views.test.ts:303
  - detail: The clamp test builds numbers plus bracketed current page and relies on default string sort; it checks several behaviors in one case. Splitting into parameterized it.each rows (page, pages, expected) would give clearer failure messages.
  - evidence: (none)
- [tests] Layout without flash messages is not asserted
  - location: test/views.test.ts:128
  - detail: No case checks that ul.messagelist is absent (or empty) when flash is []; add one assertion to pin the behavior.
  - evidence: (none)

