# Repository Guidelines for Agents

## Changelog maintenance
- Whenever you make a change that affects user-visible behavior, documentation shipped to end users, or release metadata, update `CHANGELOG.md`.
- Add the entry under the `Unreleased` section using a short descriptive bullet. If the section is missing, create it at the top of the changelog.
- If a change is strictly internal (e.g., refactors, CI tweaks), note that no changelog update is needed in your summary so reviewers understand the omission.

## Manifest & permissions
- If you add, remove, or change anything in `manifest.json` related to permissions, host permissions, or content script injection, update `manifest-notes.md` in the same PR.
- Each permission in `manifest.json` must have a 1-line justification in `manifest-notes.md`.
- If you intentionally skip the update (e.g. experimental branch), state “manifest-notes.md not updated (reason: …)” in your PR summary.
