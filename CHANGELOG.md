# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- _No changes yet._

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
