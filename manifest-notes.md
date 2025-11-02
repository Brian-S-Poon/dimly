# manifest-notes.md

- `storage` — to remember the user's dimmer level and per-site lock settings.
- `tabs` — to read the active tab’s URL so we can apply the correct per-site brightness.
- `alarms` — to wake the background service worker at scheduled times and adjust brightness automatically.
- `"<all_urls>"` — to inject the dimmer on every website, since the extension’s purpose is to dim any site.
- `content_scripts` @ `document_start` — to place the overlay before the page fully shows, avoiding a bright flash. Shared helpers (`src/shared/math.js`, `src/shared/storage.js`) now load alongside the overlay so both popup and content script use the same logic.
- `all_frames: true` — to dim iframes/embedded content along with the main page.
