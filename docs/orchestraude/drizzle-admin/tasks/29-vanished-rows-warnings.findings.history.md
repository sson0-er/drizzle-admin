## Round 1

# Review findings

high: 0, medium: 1, low: 1

## high


## medium

- [spec] Delete vanished-row test does not assert that deleted(label) is absent
  - location: test/delete.test.ts:128
  - detail: The DoD requires that the next page 'does not contain deleted(label)'. The test calls flashes(c, res, "warning"), which returns only li.warning items, so a regression that flashed both the success deleted(label) and the warning alreadyDeleted(label) would still pass. The report says the exact warning list implies deleted(label) is absent, but deleted(label) is a success-level item and the class filter never sees it. Fix: read every message item once, without the class filter, and assert it equals exactly [messages.alreadyDeleted("vanishing")] while also checking that the item carries the warning class. One option is to have flashes return {cls, text} pairs, or to assert the unfiltered list and the warning-filtered list from the same parsed document. The flash is consumed on the first GET, so two separate flashes() calls will not work.
  - evidence: (none)

## low

- [tests] alreadyDeleted test cannot detect a stray success flash
  - location: test/delete.test.ts:128
  - detail: flashes(c, res, "warning") returns only warning items, so the DoD requirement that the page does not contain deleted(label) is not asserted. If both a success and a warning were flashed, the test would still pass. Call flashes(c, res) without a class and compare to [messages.alreadyDeleted("vanishing")], then check the item's warning class if needed.
  - evidence: (none)


### Implementer response after round 1

Added messages.alreadyDeleted; a custom confirm action whose selected ids match no row now flashes noSelection and redirects 303 (src/routes/actions.ts); a single delete that removes 0 rows flashes a warning alreadyDeleted(label), otherwise success deleted(label) (src/routes/delete.ts). Delete test uses an authors row (no dependents) instead of kv. Fix round: the medium (and duplicate low) finding is fixed. The delete test now reads all flash items unfiltered from one page and asserts the exact list [alreadyDeleted(label)] plus the warning class, so a stray success deleted(label) would fail. No new exports.

