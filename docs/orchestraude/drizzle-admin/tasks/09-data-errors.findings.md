# Review findings

high: 0, medium: 0, low: 3

## high


## medium


## low

- [security] describeForLog emits name and code verbatim without sanitization
  - location: src/data/errors.ts:52
  - detail: For the 'other' kind, find() falls back to the name and code of the first error object in the chain that has a string code. That can be any error, not just one from a DB driver, and both values are written into the log line unchanged. If such an error ever carried a code or name with newlines or a very long value, it could forge or flood log lines. Today these values are driver or library constants, so the risk is theoretical. To harden, consider limiting name and code to a safe character set and length (for example /^[A-Za-z0-9_.-]{1,64}$/, else '-') before building the log line.
  - evidence: (none)
- [spec] design ambiguity: which level supplies <name> in describeForLog, and the placeholder when no code exists
  - location: src/data/errors.ts:43
  - detail: data.md and decision 011 say only "<kind> <name> <code>". The implementation takes name and code from the first cause level whose code maps to a kind (else the first level with any string code), so a PG error logs the cause's name (for example DatabaseError), not the top-level DrizzleQueryError name "Error". When no level has a code it logs the top-level name and "-". Both choices are reasonable and leak nothing, but the design does not state them. Consider recording them in data.md so routes (task using onError) and its tests rely on a stated format.
  - evidence: (none)
- [tests] isDbError instanceof DrizzleQueryError branch has no isolated test
  - location: test/errors.test.ts:68
  - detail: isDbError is only exercised through errors carrying a string code, so the DrizzleQueryError instanceof branch could be removed without a failing test. Add a synthetic case: new DrizzleQueryError('select 1', [], new Error('no code')) should give isDbError true while classifyDbError stays 'other'.
  - evidence: (none)

