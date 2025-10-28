#!/usr/bin/env python3
"""Capture a screenshot of the popup for documentation or review.

The script launches Chromium via Playwright, stubs the extension `chrome`
APIs so the popup can render outside of the browser extension runtime, and
captures a screenshot of `src/popup/index.html` while a simple HTTP server
is running in another terminal.

Example usage (from repo root):

    # In terminal 1
    python -m http.server 8000

    # In terminal 2
    python scripts/capture_popup_preview.py --output screenshots/popup-after.png \
        --site-host chatgpt.com --global-level 0.19 --site-level 0.19

This requires Playwright and its Chromium browser. Install them with:

    pip install playwright
    playwright install chromium
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

from playwright.async_api import async_playwright


DEFAULT_VIEWPORT = (360, 600)
DEFAULT_DEVICE_SCALE = 2
DEFAULT_URL = "http://127.0.0.1:8000/src/popup/index.html"


@dataclass
class PreviewConfig:
    url: str
    output: Path
    site_host: Optional[str]
    global_level: float
    site_level: Optional[float]
    viewport: Tuple[int, int]
    device_scale: float


CHROME_STUB_TEMPLATE = """
(() => {{
  const GLOBAL_KEY = 'screendimmer_global_level';
  const SITE_KEY = 'screendimmer_site_levels';
  const siteHost = {site_host};
  let globalLevel = {global_level};
  const siteLevel = {site_level};
  const siteLevels = siteHost && siteLevel != null
    ? {{ [siteHost]: siteLevel }}
    : {{}};

  function clone(obj) {{
    return JSON.parse(JSON.stringify(obj || {{}}));
  }}

  window.chrome = {{
    runtime: {{ lastError: null }},
    storage: {{
      sync: {{
        get(defaults, cb) {{
          const result = Object.assign(
            {{}},
            typeof defaults === 'object' ? defaults : {{}}
          );
          result[GLOBAL_KEY] = globalLevel;
          result[SITE_KEY] = clone(siteLevels);
          if (typeof cb === 'function') cb(result);
          return Promise.resolve(result);
        }},
        set(items) {{
          window.chrome.runtime.lastError = null;
          if (items && items[SITE_KEY]) {{
            Object.assign(siteLevels, items[SITE_KEY]);
          }}
          if (items && typeof items[GLOBAL_KEY] === 'number') {{
            globalLevel = items[GLOBAL_KEY];
          }}
          return Promise.resolve();
        }},
      }},
      local: {{
        get(defaults, cb) {{
          const result = Object.assign(
            {{}},
            typeof defaults === 'object' ? defaults : {{}}
          );
          if (typeof cb === 'function') cb(result);
          return Promise.resolve(result);
        }},
        set() {{
          window.chrome.runtime.lastError = null;
          return Promise.resolve();
        }},
        remove() {{
          window.chrome.runtime.lastError = null;
          return Promise.resolve();
        }},
      }},
    }},
    tabs: {{
      query(queryInfo, cb) {{
        window.chrome.runtime.lastError = null;
        if (typeof cb === 'function') {{
          if (siteHost) {{
            cb([{{ url: 'https://' + siteHost + '/' }}]);
          }} else {{
            cb([]);
          }}
        }}
      }},
    }},
  }};
}})();
"""


def parse_args() -> PreviewConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="URL for the popup HTML served from a local http.server",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Path to write the PNG screenshot",
    )
    parser.add_argument(
        "--site-host",
        default=None,
        help="Host name to show in the site controls (e.g., chatgpt.com)",
    )
    parser.add_argument(
        "--global-level",
        type=float,
        default=0.25,
        help="Global dimmer level to show (0-1)",
    )
    parser.add_argument(
        "--site-level",
        type=float,
        default=None,
        help="Optional site-specific level to show (0-1); if omitted, site controls show the global state",
    )
    parser.add_argument(
        "--viewport",
        type=int,
        nargs=2,
        metavar=("WIDTH", "HEIGHT"),
        default=DEFAULT_VIEWPORT,
        help="Viewport size for the popup window",
    )
    parser.add_argument(
        "--device-scale",
        type=float,
        default=DEFAULT_DEVICE_SCALE,
        help="Device scale factor to use for the screenshot",
    )

    args = parser.parse_args()
    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)

    site_host_js = "null" if args.site_host is None else repr(args.site_host)
    return PreviewConfig(
        url=args.url,
        output=output,
        site_host=site_host_js,
        global_level=args.global_level,
        site_level=args.site_level,
        viewport=tuple(args.viewport),
        device_scale=args.device_scale,
    )


async def capture_preview(cfg: PreviewConfig) -> None:
    stub_script = CHROME_STUB_TEMPLATE.format(
        site_host=cfg.site_host,
        global_level=cfg.global_level,
        site_level="null" if cfg.site_level is None else cfg.site_level,
    )

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": cfg.viewport[0], "height": cfg.viewport[1]},
            device_scale_factor=cfg.device_scale,
        )
        page = await context.new_page()
        await page.add_init_script(stub_script)
        await page.goto(cfg.url, wait_until="networkidle")
        await page.wait_for_timeout(1000)
        image_bytes = await page.screenshot(full_page=True)
        cfg.output.write_bytes(image_bytes)
        await browser.close()


def main() -> None:
    cfg = parse_args()
    asyncio.run(capture_preview(cfg))


if __name__ == "__main__":
    main()
