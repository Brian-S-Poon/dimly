# manifest-notes.md

- `storage` — to remember the user's dimmer level and per-site lock settings.
- `tabs` — to read the active tab’s URL so we can apply the correct per-site brightness.
- `"<all_urls>"` — to inject the dimmer on every website, since the extension’s purpose is to dim any site.
- `content_scripts` @ `document_start` — to place the overlay before the page fully shows, avoiding a bright flash.
- `all_frames: true` — to dim iframes/embedded content along with the main page.
