# Dimly – Screen dimmer for bright pages

Dimly is a lightweight browser extension that lets you dim any website to a comfortable brightness level. Whether you're browsing late at night or working in bright daylight, Dimly gives you fine-grained control over every page’s brightness without changing your monitor settings.

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

Dimly is also available on the Chrome Web Store.

---

## Development
```
npm install
npm run build
```

The build output goes to the `dist/` directory.  
Load that folder as the unpacked extension during development.

---

## Repository Guidelines

If you change permissions or host permissions in `manifest.json`, update `manifest-notes.md` in the same PR.  

All user-visible updates should be added under **Unreleased** in `CHANGELOG.md`.

---

## License

This project is licensed under the **MIT License**.

---

## Privacy

Dimly stores only what it needs to function — brightness levels, per-site locks, and schedule rules — using Chrome’s storage APIs.  
It never sends data anywhere. See [PRIVACY.md](./PRIVACY.md) for details.

---

## Support & Sponsorship

If Dimly helps you reduce eye strain, consider supporting continued development:

**GitHub Sponsors:** [Brian-S-Poon](https://github.com/sponsors/Brian-S-Poon)
