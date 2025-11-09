# Privacy Policy

Dimly is designed with privacy in mind. It operates entirely within your browser and never transmits data to external servers.

---

## What Dimly stores (locally)

Dimly uses Chrome’s `storage` APIs to keep your preferences local to your device. The following data is stored:

- **Global brightness level** — Your default dimming level for all sites.  
- **Per-site brightness and locks** — Custom dimming preferences for individual domains.  
- **Schedule rules** — Fixed times to automatically adjust brightness.  
- **UI preferences** — Such as dark mode or layout options, when available.

---

## Why Dimly needs permissions

- **`storage`** — Save and retrieve brightness levels and schedule rules.  
- **`tabs`** — Identify the current site to apply per-site brightness.  
- **`alarms`** — Trigger automatic brightness changes at scheduled times.  
- **`"<all_urls>"`** — Overlay the dimmer on any page you visit.  
- **`content_scripts` with `run_at: "document_start"`** — Insert the dimming layer before content loads to prevent bright flashes.

These permissions are used **only** for the purposes described above. Dimly does **not** monitor your browsing history, capture content, or collect analytics.

---

## Data collection and sharing

Dimly does **not**:

- Collect or transmit personal data.  
- Perform telemetry or usage tracking.  
- Include third-party SDKs or analytics frameworks.  

All functionality runs locally on your device.  
No information ever leaves your browser.

---

If you have privacy questions or concerns, please open an issue in the [GitHub repository](https://github.com/Brian-S-Poon/dimly).
