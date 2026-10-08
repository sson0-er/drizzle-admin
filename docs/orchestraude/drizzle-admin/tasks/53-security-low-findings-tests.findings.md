# Review findings

high: 0, medium: 0, low: 4

## high


## medium


## low

- [quality] flashItems duplicates the fetch logic of flashes and is repeated per test
  - location: test/actions.test.ts:75
  - detail: flashItems repeats the Location fetch and messagelist query of the existing flashes helper, and both selection-cap tests repeat the same three assertion lines (map text, toEqual, class check). Consider having flashes build on flashItems, or one shared assertion helper for the cap warning. Also the 'as Node' cast on items[0] could be avoided by asserting items.length via the exact list already implied.
  - evidence: (none)
- [quality] Two example host-guard rows go beyond the task list
  - location: test/example.test.ts:110
  - detail: The https://127.0.0.1 rows with ports 443 and 80 are not in the task's row list. They are harmless and valid, but are extra scope; keep only if intended.
  - evidence: (none)
- [spec] design ambiguity: L008 DoD names flashes(client, res) but the code uses a new flashItems helper
  - location: test/actions.test.ts:75
  - detail: The DoD says both cap tests 'compare the unfiltered `flashes(client, res)`' and also assert the warning class. The first GET consumes the flash cookie, so `flashes(client, res)` plus a separate class check would need a second fetch, and that fetch would see no flash. The new local helper `flashItems` is unfiltered and reads the same `ul.messagelist`. It feeds both the exact text-list comparison and the class check, so the intent of the task (an exact unfiltered list plus the level asserted once) is met. The deviation is recorded in the task History. The orchestrator should accept it or reword the DoD. No code change is needed.
  - evidence: (none)
- [spec] L010: the existing view:false assertion lines were rewritten, though the task says to keep them unchanged
  - location: test/auth.test.ts:757
  - detail: The task says 'keep the existing `view: false` assertion unchanged', and the DoD limits removed lines in test/ to the L007/L009 and L008 assertions. The change removes the original `const hrefs = ...` line and its filter assertion and routes both through the new local helpers `hrefsOn` and `authorsLinks`. The check is the same (no href starting with /admin/authors/), so coverage is not weakened. To match the task literally, restore the two original lines and put the positive control inline before them.
  - evidence: (none)

