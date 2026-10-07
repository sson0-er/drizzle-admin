# 016: Permission required to run custom actions

- Date: 2026-10-07
- Status: accepted (user answer to design question Q3)

## Context
§5.2 defines custom `actions` but no per-action permission. The routes must decide which model permission gates offering and running them.

## Decision
A custom action requires the model's `change` permission, both to be listed in the list page's action dropdown and to be run (otherwise 403). The built-in `delete_selected` action keeps requiring `delete`.

## Alternatives considered
- `view` is enough and each action's `run` checks permissions itself: lets view-only users trigger writes unless every action author remembers to check.
- A per-action `permission` option: not in §5.2, would be a public API addition the requirements do not ask for.

## Rationale
Actions usually modify rows, so `change` is the safe default and matches Django Admin's common practice of gating bulk updates on change permission (unverified against current Django docs). Chosen by the user (2026-10-07).

## Consequences
- `src/auth/permissions.ts` exports `ACTION_PERMISSION = "change"`.
- The README documents that custom actions require `change`.
