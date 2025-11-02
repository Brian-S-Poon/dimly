# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Enlarged the popup logo and title text so the Dimly branding stands out in the top bar.
- Added the Dimly logo beside the popup heading for clearer branding and fixed its image path.
- Stacked the popup site heading and lock button so long hostnames stay readable and align with the global toggle.
- Wrapped long site hostnames in the popup so the lock button stays visible on narrow layouts.
- Prevented long site names in the popup from pushing the lock button outside the card and matched the global toggle's width for consistent sizing.
- Removed the "Site ·" prefix from the popup site label so hostnames display on their own.
- Made the popup site lock toggle keep the same width whether locking or unlocking a site.
- Simplified popup copy by shortening the dim level description and removing counts from the site settings button.
- Renamed popup site management labels from "overrides" to "site settings" for clearer wording.
- Revised popup copy to clarify dim level controls and add a "More settings" label to the gear icon.
- Renamed the popup heading and description to say Dimly.
- Added a site override manager in the popup so you can edit, remove, or reset per-site dim levels.
- Updated popup hint copy to reference HTTP and HTTPS in uppercase.
- Applied the Dimly nighttime color palette to the popup for a cohesive brand look.
- Introduced configurable scheduling with sunrise/sunset support, background automation, and smoother overlay transitions.
- Moved scheduling management to a full options page and linked it from the popup for quicker access to automation settings.
- Flattened popup surfaces and buttons to remove glossy gradients and keep elevation subtle.
- Removed filled styling from the slider value and settings controls for a lighter popup header treatment.
- Trimmed popup copy to remove redundant scheduling and per-site guidance text.
- Replaced options page gradients with flat colors and simplified badges to mirror the refreshed popup styling.
- Clarified popup messaging on Chrome Web Store pages so site controls explain that Chrome blocks dimming there.
- Unified restricted-page messaging so blocked tabs now show the same guidance when Chrome prevents dimming.
- Updated popup toggle colors to use Google Blue for active states and Amber for locked overrides.
- Replaced popup and options colors with the shared brand palette for consistent theming.
- Switched popup and options typography to the Inter Google font for a consistent look.

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
