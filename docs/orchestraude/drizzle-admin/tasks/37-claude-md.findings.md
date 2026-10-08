# Review findings

high: 0, medium: 0, low: 1

## high


## medium


## low

- [spec] test/ described as 'one file per module'
  - location: CLAUDE.md:19
  - detail: test/ has files organized by concern rather than by module (headers.test.ts, proxy.test.ts, pages.test.ts, readme.test.ts, example.test.ts, password-widget.test.ts), and several modules have no test file of their own (for example src/routes/context.ts and src/views/url.ts). The task asks for each layout line to be checked against the tree. Consider dropping 'one file per module' or rewording it to something like 'mostly one file per module or concern'.
  - evidence: (none)

