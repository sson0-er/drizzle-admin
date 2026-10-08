---
id: 2026-10-08-dads-icon-terms
question: Does DADS define an icon set, and under what license?
source: https://design.digital.go.jp/introduction/notices/; https://www.digital.go.jp/policies/servicedesign/designsystem/Illustration_Icons/terms_of_use (summarized by WebFetch); snippets repo markup
fetched: 2026-10-08
expires: 2027-01-06
---
Learned:
- The snippets contain no icon font or sprite file; icons are inline `<svg viewBox="0 0 24 24">` with `fill="currentcolor"`, hand-pasted per component (chevrons, close x, error octagon, etc.), class `dads-button__icon` for buttons. Public dir has only favicon.
- Figma data includes some Material Symbols icons (Apache License 2.0, Google); the notices page does not say that the inline SVGs in the snippets are Material Symbols (unverified). Apache 2.0 requires keeping license/notice when redistributing.
- The Digital Agency illustration/icon asset terms (separate asset pack, not part of the snippets): commercial use free, attribution generally not required; modified assets must disclose the edit and source and not pose as government work (summarized by WebFetch, terms page not read verbatim).
Implication to check by design: an inline SVG approach (decision 039) matches DADS practice (currentcolor, aria-hidden); no DADS icon set to adopt wholesale.
Not confirmed: exact provenance of each snippet SVG path.
