# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Handle storage retrieval failures by falling back to default dimmer settings.

## [1.4.0] - 2025-11-02

### Added
- Added prominent Dimly branding in the popup, including an enlarged title and logo next to the heading for clearer identity.
- Added a site override manager in the popup so you can edit, remove, or reset per-site dim levels without leaving the popup.
- Introduced configurable scheduling with sunrise/sunset support, background automation, smoother overlay transitions, and a dedicated options page that the popup now links to for quick access.

### Changed
- Reworked the popup layout to keep long hostnames readable, align the site lock with the global toggle, and ensure lock controls stay visible on narrow layouts.
- Simplified popup copy by removing the "Site ·" prefix, shortening descriptions, renaming overrides to site settings, and updating restricted-page messaging, including uppercase HTTP/HTTPS references.
- Restyled popup controls and typography with the Dimly nighttime palette, flattened surfaces, refreshed slider and toggle styling with Google Blue and Amber states, and switched to the Inter font.
- Updated the settings gear into a standalone icon, removed filled styling from header controls, and trimmed redundant scheduling guidance.
- Applied the refreshed brand palette to the options page, replacing gradients and simplifying badges to match the popup.
- Clarified Chrome Web Store messaging so blocked tabs now show unified guidance when dimming is prevented.

## [1.3.0] - 2025-10-28

### Added
- Added dark mode styles to the popup so it adapts to system theme preferences.
- Added per-site dimming locks so specific websites can stay at a custom brightness level.
- Added a popup heading and description so the global dim level control is clearer.

### Changed
- Grouped popup controls into styled global and per-site sections for clearer separation.
- Popup always shows per-site dimming controls with guidance when a page isn't eligible.
- Moved popup styling into a reusable stylesheet.
- Simplified popup copy so the dimmer controls take up less space.
- Refreshed popup buttons with clearer styling and hover feedback for better affordance.
- Reworked the dim level slider layout and value pill for better spacing and readability.
- Updated the popup toggle to show on/off status text and state-aware button labels.
- Updated the manifest description to highlight per-site locks and the refreshed popup experience.

## [1.2.1] - 2025-09-13

### Added
- Dimming now remembers your preferred brightness on every site, even after you sign in somewhere else.
- The popup offers a simple brightness slider, shows the exact percentage, and includes a quick reset button.
- The screen tint sticks around when you go fullscreen or when pages load new content.

### Changed
- Updated the Chrome Web Store listing to better explain the all-site dimming and eye comfort benefits.
