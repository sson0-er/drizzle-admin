# Review findings

high: 0, medium: 0, low: 2

## high


## medium


## low

- [quality] For-loop over independent cases in new readme test
  - location: test/readme.test.ts:99
  - detail: The Language-section test loops over ['da_lang', 'Accept-Language', 'English'] inside one it. CLAUDE.md Conventions ask for an it.each table with one case per row for independent expectations. Use it.each(['da_lang','Accept-Language','English']) with the section body computed once.
  - evidence: (none)
- [tests] For-loop of expects instead of it.each
  - location: test/readme.test.ts:98
  - detail: The Language subsection test loops over ["da_lang", "Accept-Language", "English"] inside one it. Project convention is an it.each table with one case per row. Also, the `documents("_lang")` case is satisfied by any mention anywhere in the README, so it does not pin the slug row specifically; acceptable, but a weaker check than the DoD states.
  - evidence: (none)

