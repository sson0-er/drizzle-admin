---
id: 2026-10-09-dependabot-sha-pins
question: For decision 052 (Q17), does Dependabot's github-actions ecosystem update SHA-pinned actions and their version comments, and what is the minimal config?
source: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot; dependabot/dependabot-core main, github_actions/lib/dependabot/github_actions/file_updater/workflow_updater/version_commenter.rb
fetched: 2026-10-09
expires: 2027-01-07
---
Learned:
- Minimal config: `version: 2`, one `updates` entry with `package-ecosystem: "github-actions"`, `directory: "/"` (required value for workflows in `.github/workflows`) and `schedule.interval`.
- dependabot-core's `VersionCommenter` handles refs that look like commit SHAs: it finds the most specific version tag of the old SHA in the trailing comment and replaces it with the tag of the new SHA (`# v7.0.1` style comments), so SHA pins stay SHA pins.
Not confirmed: the docs page itself does not describe SHA-pin behavior; Dependabot does not touch action inputs such as mise-action's `version: 2026.10.3`.
