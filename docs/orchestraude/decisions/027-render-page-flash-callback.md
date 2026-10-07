# 027: `renderPage` accepts a page function that receives the consumed flash

- Date: 2026-10-08
- Status: accepted

## Context
`renderPage` consumes the flash cookie for 200 and 400 pages, but the design passed it a ready JSX element. The caller builds the `PageChrome` (which carries `flash`) before the flash is read, so the consumed messages had no way to reach the page. Task 14 implemented a fix; the user decided to adopt it in the design because tasks 15-21 build on it.

## Decision
`renderPage(c, status, page, opts?)` takes `page: JSX.Element | ((flash: FlashMessage[]) => JSX.Element)`. Flash is consumed only when status is 200 or 400 and `!opts.minimal`; the function form receives those messages (otherwise `[]`). Handlers that render 200/400 pages use the function form and put `flash` into their `PageChrome` (via `pageChrome(c, title, trail, flash)`).

## Alternatives considered
- Callers call `consumeFlash` themselves before building the page: duplicates the 200/400 rule in every handler and makes it easy to forget, or to consume flash on an error page.
- `renderPage` takes the chrome inputs and builds the chrome itself: couples the helper to every page's props.

## Rationale
User decision (2026-10-08). Matches the task 14 code (evidence: 2026-10-08-trailing-slash-open-redirect). Keeps the "consume only when shown" rule in one place.

## Consequences
- routes.md `renderPage` signature updated; routes-handlers.md states that 200/400 pages use the function form.
- A ready element is still accepted (error pages, which never show flash).
