# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Introduced Chrome localization support with default English messages, runtime helpers, and documentation for adding new locales.
- Added Spanish (es) localization covering all extension strings.

### Changed
- Replaced popup and options markup with runtime `data-i18n` hooks so translations load via shared helpers instead of inline `__MSG__` tokens.
- Localized popup and schedule percentage displays and fixed-time labels through shared message helpers.
- Tweaked popup and options layouts so localized strings wrap cleanly and added an ARIA live region for the global dimmer status.

## [1.5.0] - 2025-11-09

### Changed
- Rebalanced the options card layout by removing the nested schedule border, adjusting padding, and tightening mobile spacing so the editor reads as a single surface.
- Refined the disabled schedule editor styling with a tinted, dashed treatment so the inactive state is obvious at a glance.
- Increased the default popup width to match the 320px manager layout and moved manager scrolling into an inner container to prevent clipped site lists.
- Simplified rule creation to default to fixed-time triggers, keep rules always active, and drop per-rule enable toggles so the editor is easier to use.
- Simplified schedule storage by removing manual sunrise/sunset coordinate inputs and generating automatic rule names from their settings.
- Added consistent spacing above muted helper copy on the options page so live status messages line up after layout tweaks.
- Added breathing room between the "Time" label and its picker in schedule rules for a clearer layout.

### Fixed
- Handled storage retrieval failures by falling back to default dimmer settings.
- Fixed schedule retrieval so local data is used when sync storage runs out of quota.

### Removed
- Removed sunrise/sunset scheduling controls, options, and offsets from the editor so only custom times are available for the MVP.

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
