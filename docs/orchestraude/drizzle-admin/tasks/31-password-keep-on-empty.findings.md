# Review findings

high: 0, medium: 0, low: 1

## high


## medium


## low

- [tests] Integration cases depend on execution order
  - location: test/password-widget.test.ts:33
  - detail: The beforeAll seeds s3cret once, and the 'new' case overwrites it. The empty-submission case only proves 'kept' because it runs first. Re-seeding in beforeEach would make the cases independent.
  - evidence: (none)

