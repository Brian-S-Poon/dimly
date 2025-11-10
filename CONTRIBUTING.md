# Contributing to Dimly

Thank you for helping improve Dimly!  

---

## Development Setup

1. Fork and clone this repository.  
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build
   ```
4. Load the dist/ folder as an unpacked extension via chrome://extensions.

---

## Repository Guidelines

- If you change permissions or host permissions in `manifest.json`, update `manifest-notes.md` in the same PR.
- Add user-visible updates under **Unreleased** in `CHANGELOG.md`.
- Follow existing naming conventions and commit message style (`feat:`, `fix:`, `docs:`).
- Keep commits small and descriptive.

---

## Localization Workflow

- Duplicate `messages.json` from an existing locale when starting a new translation so structure and keys stay aligned. Place the copy under `_locales/<lang>/messages.json`, replacing `<lang>` with the Chrome locale code (for example, `es` or `pt-BR`).
- Retain placeholder tokens (e.g., `$SITE$`, `$PERCENT$`) exactly as they appear in the source file—only translate the surrounding text.
- After translating, run the localization sanity checks to catch missing keys or formatting issues:
  ```
  npm run test:locales
  ```
- Spot-check the new locale in Chrome by launching with the language flag, for example: `chrome --lang=<code>`.
- When you open a pull request with new translations, tag a fluent speaker or request verification from the localization reviewers so strings can be double-checked before merging.

---

## Code Style

- Use consistent indentation and trailing commas per ESLint rules.
- Keep features modular under `/src/`.
- Avoid adding external dependencies unless necessary.  
- Prefer readable, minimal code over complexity.

---

## Pull Requests

- Create a feature branch from `main`.  
- Build before submitting (`npm run build`).  
- Include screenshots or a short description for UI changes.  
- Keep PRs focused and atomic (one feature or fix per PR).

---

## Reporting Issues

Open a [GitHub issue](../../issues) for bugs, suggestions, or questions.  
Include browser version, extension version, and reproduction steps if possible.

---

## Code of Conduct

By contributing, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
