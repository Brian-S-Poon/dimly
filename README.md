# Dimly – Screen dimmer for bright pages

Dimly is a lightweight browser extension that lets you dim any website to a comfortable brightness level. Whether you're browsing late at night or working in bright daylight, Dimly gives you fine-grained control over every page’s brightness without changing your monitor settings. 

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)

---

## Table of contents
- [Features](#features)
- [Install (unpacked)](#install-unpacked)
- [Repository structure](#repository-structure)
- [Tech stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)
- [Privacy](#privacy)
- [Security](#security)
- [Support & sponsorship](#support--sponsorship)

---

## Features

- **Global dimming** — A simple slider controls brightness for all pages.  
- **Per-site brightness** — Dim specific sites independently and lock them to your preferred level.  
- **Scheduling** — Automatically dim at specific times, with smooth fade transitions when changes occur.  
- **Dark mode & modern UI** — The popup adapts to your system theme and uses a clean, accessible design.  
- **Options page** — Manage schedule rules and advanced settings from a dedicated options page.  
- **Privacy-first** — Runs entirely within your browser. No tracking, no analytics, no external servers.  


For a full history of updates, see [CHANGELOG.md](./CHANGELOG.md).

---

## Install (unpacked)

1. Clone or download this repository.  
2. Open `chrome://extensions` in Chrome (or any Chromium-based browser).  
3. Enable **Developer mode** (top right).  
4. Click **Load unpacked** and select the repository folder.

> 🧩 **Note:** These steps are for development or testing.  
> For everyday use, install the published version from the Chrome Web Store.

---

## Repository structure

```text
├── src/
│   ├── popup/           # Popup UI for global and per-site brightness control
│   ├── options/         # Options page for scheduling and advanced settings
│   ├── background/      # Background service worker handling storage and events
│   ├── content/         # Content scripts that inject and adjust the dimming overlay
│   └── shared/          # Shared utilities and constants used across components
│
├── _locales/            # Chrome localization message bundles for all supported languages
├── icons/               # Extension icons for manifest and store listing
├── images/              # Marketing and documentation assets (store listing, README, etc.)
├── scripts/             # Developer utilities (for example, the popup preview capture script)
├── tests/               # Node-based unit tests for shared logic and UI state
├── .github/
│   └── workflows/       # CI pipelines for automated tests and preview captures
│
├── manifest.json        # Chrome Extension manifest (MV3)
├── package.json         # npm metadata and test runner configuration
├── README.md            # Project overview and usage guide
├── CHANGELOG.md         # Version history of user-visible updates
├── CONTRIBUTING.md      # Development setup and pull request guidelines
├── PRIVACY.md           # Data handling and storage policy
├── SECURITY.md          # Responsible disclosure and vulnerability reporting policy
└── manifest-notes.md    # Internal notes about manifest changes and permissions
```

The diagram focuses on directories contributors interact with regularly, including `_locales/` so translation contributors know where to add new languages. Support folders such as `tests/`, `scripts/`, and `.github/workflows/` are also listed to highlight the automation and quality checks that accompany the extension.

---

## Tech Stack

- **Framework:** Chrome Extension (Manifest V3) using a background service worker, popup, options page, and content scripts  
- **Languages:** Plain JavaScript, HTML, and CSS (no bundler or transpiler)
- **Styling:** CSS custom properties and a consistent `color-scheme: dark` 
- **Storage:** Chrome Storage API (`chrome.storage.sync` with local fallback)

---

## Contributing

Contributions are welcome!
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, coding standards, and pull request guidelines.

### Localization

Dimly now supports Chrome’s localization system. To add or update a translation:

1. Copy `_locales/en/messages.json` to a new locale folder (for example, `_locales/es/messages.json`).
2. Translate the `message` values while keeping every key and placeholder (`$1`, `$PERCENT$`, etc.) intact.
3. Update any locale-specific proper nouns as needed (for example, the Chrome Web Store label used on restricted pages).

All UI strings, status messages, and manifest metadata reference these keys. Dynamic copy is resolved through `ScreenDimmerI18n.getMessage` in `src/shared/i18n.js`, so no code changes are required when adding new languages as long as the key set stays consistent.

---

## License

This project is licensed under the **MIT License**.

---

## Privacy

Dimly stores only what it needs to function: brightness levels, per-site locks, and schedule rules, using Chrome’s storage APIs.
It never sends data anywhere. See [PRIVACY.md](./PRIVACY.md) for details.

---

## Security

If you discover a potential vulnerability or security issue, please do **not** open a public GitHub issue.
Instead, report it privately by emailing **dimly@brianpoon.com** or through the
[GitHub Security Advisories](https://github.com/Brian-S-Poon/dimly/security/advisories/new) page.

See [SECURITY.md](./SECURITY.md) for details on supported versions and reporting guidelines.

---

## Support & Sponsorship

If Dimly helps you reduce eye strain, consider supporting continued development:

**GitHub Sponsors:** [Brian-S-Poon](https://github.com/sponsors/Brian-S-Poon)
